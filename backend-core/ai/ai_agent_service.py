from __future__ import annotations

import asyncio
import json
import logging
import re
from datetime import date, datetime, time, timedelta
from typing import Any, Dict

import requests
from fastapi import HTTPException, UploadFile

from config import settings

from .execution_service import (
    BudgetExecutionService,
    NoteExecutionService,
    TaskExecutionService,
    collapse_spaces,
    normalize_text,
)
from .schemas import (
    AssistantCommandResponse,
    AssistantConversationContext,
    AssistantParsedCommand,
    AssistantTranscriptionResponse,
)


logger = logging.getLogger(__name__)

GEMINI_API_KEY = settings.gemini_api_key
GEMINI_MODEL = settings.gemini_model
GROQ_API_KEY = settings.groq_api_key
GROQ_MODEL = settings.groq_model
GROQ_TRANSCRIBE_MODEL = settings.groq_transcribe_model
AI_TIMEOUT_SECONDS = settings.ai_timeout_seconds
GROQ_BASE_URL = settings.ai_api_base_url

SYSTEM_PROMPT = """You are an AI assistant for a productivity app called NoteKit.

You must convert user commands into JSON actions.

Rules:

* Output ONLY JSON
* No explanations
* Always detect intent
* Extract structured data
* Handle natural language like 'tomorrow', 'next week', 'evening'
* Detect lists and convert to arrays
* Be strict and consistent

Supported actions:
create_note, update_note, delete_note,
create_task, update_task, delete_task,
add_expense

If unsure, return:
{
"action": "unknown",
"data": {}
}
"""

SAFE_FALLBACK_JSON = {"action": "unknown", "data": {}}
DEFAULT_SUGGESTIONS = [
    "create a note called gym plan with points warmup, pushups, situps",
    "create a task buy milk at 9:45 am tomorrow",
    "spent 20 rupees on milk",
]
CHAT_SUGGESTIONS = [
    "hello",
    "what can you do?",
    "create a task buy milk at 9:45 am tomorrow",
]
ACTION_REQUIRED_FIELDS = {
    "create_note": ["title"],
    "update_note": ["query"],
    "delete_note": ["query"],
    "create_task": ["title"],
    "update_task": ["query"],
    "delete_task": ["query"],
    "add_expense": ["title", "amount"],
}
FOLLOW_UP_LABELS = {
    "title": "What title should I use?",
    "query": "Which item should I use?",
    "amount": "What amount should I use?",
}


def json_only_message(prompt_payload: Dict[str, Any]) -> str:
    return json.dumps(prompt_payload, ensure_ascii=True)


def print_trace(event: str, payload: Dict[str, Any]) -> None:
    try:
        message = json.dumps(payload, ensure_ascii=True, default=str)
    except Exception:
        message = str(payload)
    logger.debug("assistant.%s %s", event, message)


def safe_json_loads(value: str) -> Dict[str, Any]:
    raw = normalize_text(value)
    if not raw:
        return {}
    try:
        payload = json.loads(raw)
        return payload if isinstance(payload, dict) else {}
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start >= 0 and end > start:
            try:
                payload = json.loads(raw[start : end + 1])
                return payload if isinstance(payload, dict) else {}
            except json.JSONDecodeError:
                return {}
    return {}


def extract_amount(text: str) -> float | None:
    match = re.search(r"(-?\d+(?:\.\d+)?)", text or "")
    if not match:
        return None
    try:
        amount = float(match.group(1))
    except ValueError:
        return None
    return amount if amount > 0 else None


def normalize_common_speech_typos(text: str) -> str:
    value = normalize_text(text)
    replacements = {
        "tommarow": "tomorrow",
        "tommorow": "tomorrow",
        "tmrw": "tomorrow",
    }
    for src, dest in replacements.items():
        value = re.sub(rf"\b{re.escape(src)}\b", dest, value, flags=re.IGNORECASE)
    value = re.sub(r"\bat\s+(\d{1,2})\s+(\d{2})\b", r"at \1:\2", value, flags=re.IGNORECASE)
    return value


def strip_spoken_prefix(text: str) -> str:
    value = collapse_spaces(text)
    value = re.sub(
        r"^(okay|ok|hey|please|can you|could you|would you)\b[\s,]*",
        "",
        value,
        flags=re.IGNORECASE,
    )
    return collapse_spaces(value)


def strip_task_query_noise(text: str) -> str:
    value = collapse_spaces(text)
    value = re.sub(
        r"^(delete|remove|update|edit|change)(?:\s+the|\s+a)?\s+(task|todo)\s+",
        "",
        value,
        flags=re.IGNORECASE,
    )
    value = re.sub(r"^(saying|called|named)\s+", "", value, flags=re.IGNORECASE)
    value = re.sub(r"^(that\s+is|that\s+says)\s+", "", value, flags=re.IGNORECASE)
    return collapse_spaces(value)


def strip_note_query_noise(text: str) -> str:
    value = strip_spoken_prefix(collapse_spaces(text))
    value = re.sub(
        r"^(delete|remove|update|edit|change)(?:\s+the|\s+a)?\s+note\s+",
        "",
        value,
        flags=re.IGNORECASE,
    )
    value = re.sub(r"^(saying|called|named|titled)\s+", "", value, flags=re.IGNORECASE)
    value = re.sub(r"^(that\s+is|that\s+says)\s+", "", value, flags=re.IGNORECASE)
    return collapse_spaces(value).strip("?.!, ")


def parse_relative_date(raw_value: str) -> date | None:
    raw = normalize_common_speech_typos(raw_value).lower()
    if not raw:
        return None
    today = datetime.utcnow().date()
    if raw == "today":
        return today
    if raw == "tomorrow":
        return today + timedelta(days=1)
    if raw == "day after tomorrow":
        return today + timedelta(days=2)
    if raw == "next week":
        return today + timedelta(days=7)
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def resolve_date_from_text(text: str) -> date | None:
    lower_text = normalize_common_speech_typos(text).lower()
    for token in ("day after tomorrow", "tomorrow", "today", "next week"):
        if token in lower_text:
            return parse_relative_date(token)
    for pattern in (r"\d{4}-\d{2}-\d{2}", r"\d{2}-\d{2}-\d{4}", r"\d{2}/\d{2}/\d{4}"):
        match = re.search(pattern, text)
        if match:
            return parse_relative_date(match.group(0))
    return None


def resolve_time_from_text(text: str) -> time | None:
    lower_text = normalize_common_speech_typos(text).lower()
    match = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b", lower_text)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2) or 0)
        suffix = match.group(3)
        if suffix == "pm" and hour != 12:
            hour += 12
        if suffix == "am" and hour == 12:
            hour = 0
        return time(hour=hour, minute=minute)

    match = re.search(r"\b([01]?\d|2[0-3]):([0-5]\d)\b", lower_text)
    if match:
        return time(hour=int(match.group(1)), minute=int(match.group(2)))

    defaults = {
        "morning": time(hour=9, minute=0),
        "afternoon": time(hour=15, minute=0),
        "evening": time(hour=18, minute=0),
        "night": time(hour=21, minute=0),
        "noon": time(hour=12, minute=0),
    }
    for keyword, resolved in defaults.items():
        if keyword in lower_text:
            return resolved
    return None


def build_iso_datetime(text: str) -> str | None:
    resolved_date = resolve_date_from_text(text)
    resolved_time = resolve_time_from_text(text)
    if not resolved_date and not resolved_time:
        return None
    if not resolved_date:
        resolved_date = datetime.utcnow().date()
    if not resolved_time:
        resolved_time = time(hour=9, minute=0)
    return datetime.combine(resolved_date, resolved_time).isoformat(timespec="minutes")


def parse_note_points(text: str) -> list[str]:
    lower_text = text.lower()
    for marker in (" with points ", " points ", " with bullets ", " bullets ", " items "):
        if marker in lower_text:
            tail = text[lower_text.index(marker) + len(marker) :]
            return [collapse_spaces(part) for part in re.split(r",|\n|;|\band\b", tail) if collapse_spaces(part)]
    return []


def normalize_action_payload(payload: Dict[str, Any]) -> AssistantParsedCommand:
    action = normalize_text(payload.get("action")) or "unknown"
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}

    allowed_actions = {
        "create_note",
        "update_note",
        "delete_note",
        "create_task",
        "update_task",
        "delete_task",
        "add_expense",
    }
    if action not in allowed_actions:
        action = "unknown"

    normalized: Dict[str, Any] = {}
    for key, value in data.items():
        normalized[key] = collapse_spaces(value) if isinstance(value, str) else value

    if action in {"create_note", "update_note", "delete_note"}:
        if not normalized.get("query"):
            normalized["query"] = (
                normalize_text(normalized.get("note_name"))
                or normalize_text(normalized.get("note_query"))
                or normalize_text(normalized.get("name"))
            )
        if not normalized.get("content"):
            if isinstance(normalized.get("contents"), list):
                normalized["content"] = normalized.get("contents")
            elif normalize_text(normalized.get("contents")):
                normalized["content"] = normalize_text(normalized.get("contents"))
            elif isinstance(normalized.get("subjects"), list):
                normalized["content"] = normalized.get("subjects")
            elif normalize_text(normalized.get("details")):
                normalized["content"] = normalize_text(normalized.get("details"))
        if action == "create_note" and not normalized.get("content") and isinstance(normalized.get("subjects"), list):
            normalized["content"] = normalized.get("subjects")

    if "amount" in normalized:
        try:
            normalized["amount"] = float(normalized["amount"])
        except (TypeError, ValueError):
            normalized["amount"] = None

    if "datetime" in normalized and normalize_text(normalized.get("datetime")):
        try:
            normalized["datetime"] = datetime.fromisoformat(normalize_text(normalized["datetime"])).isoformat(timespec="minutes")
        except ValueError:
            fallback_datetime = build_iso_datetime(normalize_text(normalized["datetime"]))
            normalized["datetime"] = fallback_datetime or normalize_text(normalized["datetime"])

    if action == "add_expense":
        normalized["category"] = normalize_text(normalized.get("category")) or "general"

    missing_fields = [field for field in ACTION_REQUIRED_FIELDS.get(action, []) if normalized.get(field) in (None, "", [])]
    return AssistantParsedCommand(
        action=action,
        data=normalized,
        missing_fields=missing_fields,
        follow_up_question=FOLLOW_UP_LABELS.get(missing_fields[0], "") if missing_fields else "",
    )


class AssistantService:
    def __init__(self) -> None:
        self.notes = NoteExecutionService()
        self.tasks = TaskExecutionService()
        self.budget = BudgetExecutionService()

    def parse_context(self, context_json: str | None) -> AssistantConversationContext:
        payload = safe_json_loads(context_json or "")
        try:
            return AssistantConversationContext(**payload) if payload else AssistantConversationContext()
        except Exception:
            return AssistantConversationContext()

    async def handle_command(
        self,
        current_user: Dict[str, Any],
        text: str | None = None,
        audio: UploadFile | None = None,
        context_json: str | None = None,
    ) -> AssistantCommandResponse:
        transcript = normalize_text(text)
        if audio is not None:
            transcription = await self.transcribe_upload(audio)
            transcript = transcription.text

        print_trace(
            "request",
            {
                "user": normalize_text(current_user.get("email")).lower(),
                "text": transcript,
                "has_audio": audio is not None,
            },
        )

        if not transcript:
            response = AssistantCommandResponse(
                ok=False,
                intent_type="unknown",
                message="I could not understand the request.",
                suggestions=DEFAULT_SUGGESTIONS,
            )
            print_trace("response", response.model_dump())
            return response

        context = self.parse_context(context_json)
        parsed = await self.parse_action(transcript, context)
        print_trace("parsed", parsed.model_dump())
        if parsed.action == "unknown":
            response = await self.build_chat_or_fallback_response(transcript)
            print_trace("response", response.model_dump())
            return response

        if parsed.missing_fields:
            response = AssistantCommandResponse(
                ok=False,
                intent_type="action",
                transcript=transcript,
                parsed_command=parsed,
                message=parsed.follow_up_question or "Please share a bit more detail.",
                needs_follow_up=True,
                missing_fields=parsed.missing_fields,
                follow_up_question=parsed.follow_up_question,
                suggestions=DEFAULT_SUGGESTIONS,
            )
            print_trace("response", response.model_dump())
            return response

        try:
            response = await self.execute_command(current_user, transcript, parsed)
            print_trace("response", response.model_dump())
            return response
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("assistant.execution_failed error=%s", exc)
            print_trace("execution_failed", {"error": str(exc), "transcript": transcript, "action": parsed.action})
            response = self.build_fallback_response(transcript)
            print_trace("response", response.model_dump())
            return response

    async def parse_action(
        self,
        transcript: str,
        context: AssistantConversationContext,
    ) -> AssistantParsedCommand:
        pending = context.pending_command
        if self.should_reset_pending_command(transcript, pending):
            pending = None
        shortcut = self.shortcut_parse(transcript, pending)
        if shortcut.action != "unknown":
            return shortcut

        ai_payload = await self.parse_with_ai(transcript, pending)
        normalized = normalize_action_payload(ai_payload)
        if normalized.action != "unknown":
            return self.merge_with_pending(normalized, pending)

        heuristic = self.fallback_parse(transcript, pending)
        return self.merge_with_pending(heuristic, pending)

    def merge_with_pending(
        self,
        parsed: AssistantParsedCommand,
        pending: AssistantParsedCommand | None,
    ) -> AssistantParsedCommand:
        if not pending or pending.action == "unknown":
            return parsed

        action = parsed.action if parsed.action != "unknown" else pending.action
        data = dict(pending.data or {})
        data.update(parsed.data or {})
        return normalize_action_payload({"action": action, "data": data})

    def should_reset_pending_command(
        self,
        transcript: str,
        pending: AssistantParsedCommand | None,
    ) -> bool:
        if not pending or not pending.missing_fields:
            return False
        text = normalize_common_speech_typos(collapse_spaces(transcript))
        lower_text = text.lower()

        fresh_action_patterns = [
            r"\b(create|add|make|write)\b.*\bnote\b",
            r"\b(update|edit|change|delete|remove)\b.*\bnote\b",
            r"\b(create|add|make|update|edit|change|delete|remove)\b.*\b(task|todo)\b",
            r"\b(project)\b.*\b(task)\b",
            r"\b(spent|spend|paid|expense)\b",
            r"\b(remind me to)\b",
        ]
        chat_patterns = [
            r"^(hi|hii|hello|hey|good morning|good afternoon|good evening)\b",
            r"\bhow are you\b",
            r"\bwho are you\b",
            r"\bwhat are you\b",
            r"\bwhat can you do\b",
            r"\bcan you hear me\b",
        ]
        return any(re.search(pattern, lower_text) for pattern in fresh_action_patterns + chat_patterns)

    def task_title_from_text(self, text: str) -> str:
        cleaned = normalize_common_speech_typos(strip_spoken_prefix(text))
        cleaned = re.sub(
            r"^(create|add|make)(?:\s+a)?(?:\s+new)?\s+(task|todo)\s+",
            "",
            cleaned,
            flags=re.IGNORECASE,
        )
        cleaned = re.sub(r"^(saying that|saying|that says|called|named|of)\s+", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(
            r"\b(today|tomorrow|next week|morning|afternoon|evening|night|noon)\b",
            "",
            cleaned,
            flags=re.IGNORECASE,
        )
        cleaned = re.sub(r"\bat\s+\d{1,2}(?::\d{2})?\s*(am|pm)?\b", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\b\d{1,2}(?::\d{2})?\s*(am|pm)\b", "", cleaned, flags=re.IGNORECASE)
        return collapse_spaces(cleaned)

    def project_name_from_text(self, text: str) -> str | None:
        match = re.search(r"\bproject\s+(?:named|called)\s+(.+?)(?:\s+and\b|$)", text, re.IGNORECASE)
        return collapse_spaces(match.group(1)) if match else None

    def shortcut_parse(
        self,
        transcript: str,
        pending: AssistantParsedCommand | None = None,
    ) -> AssistantParsedCommand:
        text = normalize_common_speech_typos(collapse_spaces(transcript))
        lower_text = text.lower()

        if pending and pending.missing_fields:
            data = dict(pending.data or {})
            for field in pending.missing_fields:
                if field in {"title", "query"}:
                    data[field] = text
                elif field == "amount":
                    data[field] = extract_amount(text)
            return normalize_action_payload({"action": pending.action, "data": data})

        if re.match(r"^(okay|ok|please)\s+", lower_text):
            cleaned_text = strip_spoken_prefix(text)
            return self.shortcut_parse(cleaned_text, pending)

        if lower_text.startswith(("create note", "create a note", "add note", "write a note", "create me a note", "make me a note")):
            title_match = re.search(r"(?:called|named|titled)\s+(.+?)(?:\s+with\s+(?:points|bullets)\s+|$)", text, re.IGNORECASE)
            title = collapse_spaces(title_match.group(1)) if title_match else ""
            points = parse_note_points(text)
            if not title:
                title = collapse_spaces(re.sub(r"^(create|add|write|make)(?:\s+me|\s+a)?\s+note\s*", "", text, flags=re.IGNORECASE))
                if points:
                    title = collapse_spaces(title.split(" with ")[0])
            saying_match = re.search(r"(?:create|add|write|make)(?:\s+me|\s+a)?\s+note\s+saying\s+(.+?)(?:\s+with\s+details|\s+and\s+include|$)", text, re.IGNORECASE)
            if saying_match:
                title = collapse_spaces(saying_match.group(1))
            content_match = re.search(r"(?:include|content|saying that|that says)\s+(.+)$", text, re.IGNORECASE)
            details_match = re.search(r"(?:with\s+details(?:\s+in\s+it)?\s+as)\s+(.+)$", text, re.IGNORECASE)
            content = collapse_spaces(content_match.group(1)) if content_match else (points or "")
            if not content and details_match:
                content = collapse_spaces(details_match.group(1))
            if title.lower() in {"that vegetables", "vegetables"} and content:
                title = "Buy Vegetables"
            return normalize_action_payload({"action": "create_note", "data": {"title": title, "content": content}})

        if re.search(r"\b(update|edit|change)\b.*\bnote\b", lower_text):
            match = re.search(
                r"(?:update|edit|change)\s+(?:the\s+)?note\s+(?:saying|called|named|titled)?\s*(.+?)(?:\s+and\s+include|\s+to\s+|\s+with\s+|$)",
                text,
                re.IGNORECASE,
            )
            query = strip_note_query_noise(match.group(1)) if match else ""
            content_match = re.search(r"(?:and\s+include(?:\s+the\s+details)?(?:\s+saying)?|to|with)\s+(.+)$", text, re.IGNORECASE)
            content = collapse_spaces(content_match.group(1)) if content_match else ""
            return normalize_action_payload({"action": "update_note", "data": {"query": query, "content": content}})

        if re.search(r"\b(delete|remove)\b.*\bnote\b", lower_text):
            query = strip_note_query_noise(strip_spoken_prefix(text))
            return normalize_action_payload({"action": "delete_note", "data": {"query": query}})

        project_match = re.search(r"project\s+(?:named|called)\s+(.+?)\s+and\s+add\s+task\s+(.+)$", text, re.IGNORECASE)
        if project_match:
            project = collapse_spaces(project_match.group(1))
            task_tail = collapse_spaces(project_match.group(2))
            return normalize_action_payload(
                {
                    "action": "create_task",
                    "data": {
                        "title": self.task_title_from_text(task_tail),
                        "datetime": build_iso_datetime(task_tail),
                        "project": project,
                    },
                }
            )

        if re.search(r"\b(create|add|make)\b.*\b(task|todo)\b", lower_text) or lower_text.startswith("remind me to"):
            source = re.sub(r"^remind me to\s*", "", text, flags=re.IGNORECASE) if lower_text.startswith("remind me to") else re.sub(
                r"^(create|add|make)(?:\s+a)?(?:\s+new)?\s+(task|todo)\s*", "", text, flags=re.IGNORECASE
            )
            return normalize_action_payload(
                {
                    "action": "create_task",
                    "data": {
                        "title": self.task_title_from_text(source),
                        "datetime": build_iso_datetime(source),
                        "project": self.project_name_from_text(text),
                    },
                }
            )

        if re.search(r"\b(update|edit|change)\b.*\b(task|todo)\b", lower_text):
            query_match = re.search(r"(?:update|edit|change)\s+(?:task|todo)\s+(.+?)(?:\s+to\s+|\s+at\s+|$)", text, re.IGNORECASE)
            query = strip_task_query_noise(query_match.group(1)) if query_match else ""
            title_match = re.search(r"\bto\s+(.+?)(?:\s+at\s+|\s+tomorrow|\s+today|$)", text, re.IGNORECASE)
            title = collapse_spaces(title_match.group(1)) if title_match else ""
            return normalize_action_payload(
                {"action": "update_task", "data": {"query": query, "title": title, "datetime": build_iso_datetime(text)}}
            )

        if re.search(r"\b(delete|remove)\b.*\b(task|todo)\b", lower_text):
            query = strip_task_query_noise(text)
            return normalize_action_payload({"action": "delete_task", "data": {"query": query}})

        if re.search(r"\b(spent|spend|paid|expense)\b", lower_text):
            amount = extract_amount(text)
            title_match = re.search(r"(?:on|for)\s+(.+)$", text, re.IGNORECASE)
            title = collapse_spaces(title_match.group(1)) if title_match else ""
            return normalize_action_payload(
                {
                    "action": "add_expense",
                    "data": {
                        "title": title,
                        "amount": amount,
                        "category": "general",
                        "date": (resolve_date_from_text(text) or datetime.utcnow().date()).isoformat(),
                    },
                }
            )

        return AssistantParsedCommand(action="unknown", data={})

    def fallback_parse(
        self,
        transcript: str,
        pending: AssistantParsedCommand | None = None,
    ) -> AssistantParsedCommand:
        return self.shortcut_parse(transcript, pending)

    def looks_like_chat_message(self, transcript: str) -> bool:
        text = normalize_text(transcript).lower()
        if not text:
            return False
        if self.shortcut_parse(transcript).action != "unknown":
            return False
        chat_patterns = [
            r"^(hi|hii|hello|hey|good morning|good afternoon|good evening)\b",
            r"\bhow are you\b",
            r"\bwho are you\b",
            r"\bwhat can you do\b",
            r"\bhelp\b",
            r"\bthank(s| you)\b",
            r"\bwhat is notekit\b",
        ]
        if any(re.search(pattern, text) for pattern in chat_patterns):
            return True
        if "?" in transcript:
            return True
        return not self.looks_like_strong_action_request(text)

    def looks_like_strong_action_request(self, lower_text: str) -> bool:
        patterns = [
            r"\b(create|add|make|write|update|edit|change|delete|remove)\b.*\bnote\b",
            r"\b(create|add|make|update|edit|change|delete|remove)\b.*\b(task|todo)\b",
            r"\bremind me to\b",
            r"\b(spent|spend|paid|expense)\b",
        ]
        return any(re.search(pattern, lower_text) for pattern in patterns)

    async def build_chat_or_fallback_response(self, transcript: str) -> AssistantCommandResponse:
        if self.looks_like_chat_message(transcript):
            message = await self.chat_response(transcript)
            return AssistantCommandResponse(
                ok=True,
                intent_type="chat",
                transcript=transcript,
                message=message,
                suggestions=CHAT_SUGGESTIONS,
            )
        return self.build_fallback_response(transcript)

    async def chat_response(self, transcript: str) -> str:
        local = self.local_chat_response(transcript)
        if local:
            return local
        ai_reply = await self.ai_chat_response(transcript)
        if ai_reply:
            return ai_reply
        return "I'm here and ready to help with notes, tasks, and budgets. Try asking me to create something or ask what I can do."

    def local_chat_response(self, transcript: str) -> str:
        text = normalize_text(transcript).lower()
        if "can you hear me" in text:
            return "Yes, I can hear you. I'm DUDE!, your NoteKit assistant."
        if re.search(r"^(hi|hii|hello|hey|good morning|good afternoon|good evening)\b", text):
            return "Hi! I'm DUDE!, your NoteKit assistant. I'm here to help with notes, tasks, budgets, and anything inside NoteKit."
        if "how are you" in text:
            return "I'm doing great. I'm DUDE!, and I'm ready to help you inside NoteKit."
        if "who are you" in text:
            return "I am your NoteKit assistant called DUDE!. I help you chat, create notes, manage tasks, and log expenses."
        if "what are you" in text:
            return "I am DUDE!, your NoteKit assistant. I work inside NoteKit to help with notes, tasks, and budgets."
        if "what can you do" in text or text == "help":
            return (
                "I am DUDE!, your NoteKit assistant. I can chat with you, create notes, create tasks with date and time, and log expenses. "
                "Try saying: create a task buy milk at 9:45 am tomorrow."
            )
        if "what is notekit" in text:
            return "NoteKit is your productivity app for notes, tasks, and budgets in one place."
        if "thank" in text:
            return "You're welcome. DUDE! is here whenever you need me."
        return ""

    async def ai_chat_response(self, transcript: str) -> str:
        payload = {
            "today": datetime.utcnow().date().isoformat(),
            "user_input": transcript,
            "app_context": "NoteKit helps users manage notes, tasks, and budgets.",
        }
        try:
            return await self.call_gemini_chat(payload)
        except Exception as gemini_error:
            logger.warning("assistant.gemini_chat_failed error=%s", gemini_error)
            print_trace("gemini_chat_failed", {"error": str(gemini_error), "text": transcript})
            try:
                return await self.call_groq_chat(payload)
            except Exception as groq_error:
                logger.warning("assistant.groq_chat_failed error=%s", groq_error)
                print_trace("groq_chat_failed", {"error": str(groq_error), "text": transcript})
                return ""

    async def parse_with_ai(self, transcript: str, pending: AssistantParsedCommand | None) -> Dict[str, Any]:
        payload = {
            "today": datetime.utcnow().date().isoformat(),
            "pending_command": pending.model_dump() if pending else None,
            "user_input": transcript,
            "required_json_shape": {"action": "action_name", "data": {}},
        }
        try:
            return await self.call_gemini(payload)
        except Exception as gemini_error:
            logger.warning("assistant.gemini_failed error=%s", gemini_error)
            print_trace("gemini_failed", {"error": str(gemini_error), "text": transcript})
            try:
                return await self.call_groq(payload)
            except Exception as groq_error:
                logger.warning("assistant.groq_failed error=%s", groq_error)
                print_trace("groq_failed", {"error": str(groq_error), "text": transcript})
                return SAFE_FALLBACK_JSON

    async def call_gemini(self, prompt_payload: Dict[str, Any]) -> Dict[str, Any]:
        if not GEMINI_API_KEY:
            raise RuntimeError("Gemini API key missing")
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
        )

        def _request(retry: bool = False) -> Dict[str, Any]:
            system_instruction = SYSTEM_PROMPT if not retry else f"{SYSTEM_PROMPT}\nReturn valid JSON only."
            response = requests.post(
                url,
                headers={"Content-Type": "application/json"},
                json={
                    "system_instruction": {"parts": [{"text": system_instruction}]},
                    "generationConfig": {"temperature": 0},
                    "contents": [{"parts": [{"text": json_only_message(prompt_payload)}]}],
                },
                timeout=AI_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            payload = response.json()
            text = ""
            for candidate in payload.get("candidates", []):
                for part in candidate.get("content", {}).get("parts", []):
                    text += part.get("text", "")
            parsed = safe_json_loads(text)
            if parsed:
                return parsed
            if retry:
                raise ValueError("Gemini returned invalid JSON")
            return _request(retry=True)

        return await asyncio.to_thread(_request)

    async def call_gemini_chat(self, prompt_payload: Dict[str, Any]) -> str:
        if not GEMINI_API_KEY:
            raise RuntimeError("Gemini API key missing")
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
        )

        def _request() -> str:
            response = requests.post(
                url,
                headers={"Content-Type": "application/json"},
                json={
                    "system_instruction": {
                        "parts": [
                            {
                                "text": (
                                    "You are the NoteKit assistant. Reply naturally and briefly. "
                                    "You can answer greetings, app questions, and general help questions. "
                                    "Mention notes, tasks, and budgets when useful."
                                )
                            }
                        ]
                    },
                    "generationConfig": {"temperature": 0.3},
                    "contents": [{"parts": [{"text": json_only_message(prompt_payload)}]}],
                },
                timeout=AI_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            payload = response.json()
            text = ""
            for candidate in payload.get("candidates", []):
                for part in candidate.get("content", {}).get("parts", []):
                    text += part.get("text", "")
            return collapse_spaces(text)

        return await asyncio.to_thread(_request)

    async def call_groq(self, prompt_payload: Dict[str, Any]) -> Dict[str, Any]:
        if not GROQ_API_KEY:
            raise RuntimeError("Groq API key missing")

        def _request(retry: bool = False) -> Dict[str, Any]:
            response = requests.post(
                f"{GROQ_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": GROQ_MODEL,
                    "temperature": 0,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {
                            "role": "system",
                            "content": SYSTEM_PROMPT if not retry else f"{SYSTEM_PROMPT}\nReturn valid JSON only.",
                        },
                        {"role": "user", "content": json_only_message(prompt_payload)},
                    ],
                },
                timeout=AI_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            payload = response.json()
            content = payload.get("choices", [{}])[0].get("message", {}).get("content", "")
            parsed = safe_json_loads(content)
            if parsed:
                return parsed
            if retry:
                raise ValueError("Groq returned invalid JSON")
            return _request(retry=True)

        return await asyncio.to_thread(_request)

    async def call_groq_chat(self, prompt_payload: Dict[str, Any]) -> str:
        if not GROQ_API_KEY:
            raise RuntimeError("Groq API key missing")

        def _request() -> str:
            response = requests.post(
                f"{GROQ_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": GROQ_MODEL,
                    "temperature": 0.3,
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "You are the NoteKit assistant. Reply naturally and briefly. "
                                "You can answer greetings, app questions, and general help questions. "
                                "Mention notes, tasks, and budgets when useful."
                            ),
                        },
                        {"role": "user", "content": json_only_message(prompt_payload)},
                    ],
                },
                timeout=AI_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            payload = response.json()
            content = payload.get("choices", [{}])[0].get("message", {}).get("content", "")
            return collapse_spaces(content)

        return await asyncio.to_thread(_request)

    async def transcribe_upload(self, audio: UploadFile) -> AssistantTranscriptionResponse:
        audio_bytes = await audio.read()
        file_size = len(audio_bytes or b"")
        if file_size <= 0:
            return AssistantTranscriptionResponse(
                ok=False,
                text="",
                message="The recording was empty. Please try again.",
                file_size_bytes=file_size,
            )
        if not GROQ_API_KEY:
            return AssistantTranscriptionResponse(
                ok=False,
                text="",
                message="Voice transcription is not configured on the server yet.",
                file_size_bytes=file_size,
            )

        filename = audio.filename or "voice-command.m4a"
        content_type = audio.content_type or "audio/m4a"

        def _request() -> str:
            response = requests.post(
                f"{GROQ_BASE_URL}/audio/transcriptions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                data={"model": GROQ_TRANSCRIBE_MODEL},
                files={"file": (filename, audio_bytes, content_type)},
                timeout=AI_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            payload = response.json()
            return collapse_spaces(payload.get("text"))

        try:
            transcript = await asyncio.to_thread(_request)
        except Exception as exc:
            logger.exception("assistant.transcription_failed error=%s", exc)
            transcript = ""

        return AssistantTranscriptionResponse(
            ok=bool(transcript),
            text=transcript,
            message="Transcription completed." if transcript else "I could not transcribe that audio clearly.",
            file_size_bytes=file_size,
        )

    async def execute_command(
        self,
        current_user: Dict[str, Any],
        transcript: str,
        parsed: AssistantParsedCommand,
    ) -> AssistantCommandResponse:
        action = parsed.action
        data = parsed.data or {}

        if action == "create_note":
            created = await self.notes.create_note(current_user, data.get("title", ""), data.get("content", ""))
            return AssistantCommandResponse(
                ok=True,
                intent_type="action",
                transcript=transcript,
                parsed_command=parsed,
                message="Note created successfully.",
                resource_type="note",
                operation="create",
                resource=created,
                suggestions=DEFAULT_SUGGESTIONS,
            )

        if action == "update_note":
            target = await self.notes.find_note(current_user, data.get("query", ""))
            if not target:
                pending = AssistantParsedCommand(action=action, data=data, missing_fields=["query"], follow_up_question=FOLLOW_UP_LABELS["query"])
                return AssistantCommandResponse(
                    ok=False,
                    intent_type="action",
                    transcript=transcript,
                    parsed_command=pending,
                    message=pending.follow_up_question,
                    needs_follow_up=True,
                    missing_fields=pending.missing_fields,
                    follow_up_question=pending.follow_up_question,
                    suggestions=DEFAULT_SUGGESTIONS,
                )
            updated = await self.notes.update_note(current_user, target["id"], title=data.get("title"), content=data.get("content"))
            return AssistantCommandResponse(
                ok=True,
                intent_type="action",
                transcript=transcript,
                parsed_command=parsed,
                message="Note updated successfully.",
                resource_type="note",
                operation="update",
                resource=updated,
                suggestions=DEFAULT_SUGGESTIONS,
            )

        if action == "delete_note":
            target = await self.notes.find_note(current_user, data.get("query", ""))
            if not target:
                pending = AssistantParsedCommand(action=action, data=data, missing_fields=["query"], follow_up_question=FOLLOW_UP_LABELS["query"])
                return AssistantCommandResponse(
                    ok=False,
                    intent_type="action",
                    transcript=transcript,
                    parsed_command=pending,
                    message=pending.follow_up_question,
                    needs_follow_up=True,
                    missing_fields=pending.missing_fields,
                    follow_up_question=pending.follow_up_question,
                    suggestions=DEFAULT_SUGGESTIONS,
                )
            await self.notes.delete_note(current_user, target["id"])
            return AssistantCommandResponse(
                ok=True,
                intent_type="action",
                transcript=transcript,
                parsed_command=parsed,
                message="Note deleted successfully.",
                resource_type="note",
                operation="delete",
                resource={"id": target["id"], "title": target["title"]},
                suggestions=DEFAULT_SUGGESTIONS,
            )

        if action == "create_task":
            created = await self.tasks.create_task(
                current_user,
                title=data.get("title", ""),
                datetime_iso=data.get("datetime"),
                project=data.get("project"),
            )
            return AssistantCommandResponse(
                ok=True,
                intent_type="action",
                transcript=transcript,
                parsed_command=parsed,
                message="Task created successfully.",
                resource_type="todo",
                operation="create",
                resource=created,
                suggestions=DEFAULT_SUGGESTIONS,
            )

        if action == "update_task":
            found = await self.tasks.find_task(current_user, data.get("query", ""))
            if not found:
                pending = AssistantParsedCommand(action=action, data=data, missing_fields=["query"], follow_up_question=FOLLOW_UP_LABELS["query"])
                return AssistantCommandResponse(
                    ok=False,
                    intent_type="action",
                    transcript=transcript,
                    parsed_command=pending,
                    message=pending.follow_up_question,
                    needs_follow_up=True,
                    missing_fields=pending.missing_fields,
                    follow_up_question=pending.follow_up_question,
                    suggestions=DEFAULT_SUGGESTIONS,
                )
            updated = await self.tasks.update_task(
                current_user,
                query=data.get("query", ""),
                title=data.get("title"),
                datetime_iso=data.get("datetime"),
                project=data.get("project"),
            )
            cleanup_ids = [found["item"].get("notificationId") or ""] if found["item"].get("notificationId") else []
            return AssistantCommandResponse(
                ok=True,
                intent_type="action",
                transcript=transcript,
                parsed_command=parsed,
                message="Task updated successfully.",
                resource_type="todo",
                operation="update",
                resource=updated,
                cleanup_notification_ids=cleanup_ids,
                suggestions=DEFAULT_SUGGESTIONS,
            )

        if action == "delete_task":
            found = await self.tasks.find_task(current_user, data.get("query", ""))
            if not found:
                pending = AssistantParsedCommand(action=action, data=data, missing_fields=["query"], follow_up_question=FOLLOW_UP_LABELS["query"])
                return AssistantCommandResponse(
                    ok=False,
                    intent_type="action",
                    transcript=transcript,
                    parsed_command=pending,
                    message=pending.follow_up_question,
                    needs_follow_up=True,
                    missing_fields=pending.missing_fields,
                    follow_up_question=pending.follow_up_question,
                    suggestions=DEFAULT_SUGGESTIONS,
                )
            cleanup_ids = [found["item"].get("notificationId") or ""] if found["item"].get("notificationId") else []
            deleted = await self.tasks.delete_task(current_user, query=data.get("query", ""))
            return AssistantCommandResponse(
                ok=True,
                intent_type="action",
                transcript=transcript,
                parsed_command=parsed,
                message="Task deleted successfully.",
                resource_type="todo",
                operation="delete",
                resource=deleted,
                cleanup_notification_ids=cleanup_ids,
                suggestions=DEFAULT_SUGGESTIONS,
            )

        if action == "add_expense":
            spend_date = parse_relative_date(data.get("date") or "") or datetime.utcnow().date()
            created = await self.budget.add_expense(
                current_user,
                title=data.get("title", ""),
                amount=float(data.get("amount") or 0),
                category=data.get("category") or "general",
                spend_date=spend_date,
            )
            return AssistantCommandResponse(
                ok=True,
                intent_type="action",
                transcript=transcript,
                parsed_command=parsed,
                message="Expense added successfully.",
                resource_type="spend",
                operation="create",
                resource=created,
                suggestions=DEFAULT_SUGGESTIONS,
            )

        return self.build_fallback_response(transcript)

    def build_fallback_response(self, transcript: str) -> AssistantCommandResponse:
        return AssistantCommandResponse(
            ok=False,
            intent_type="unknown",
            transcript=transcript,
            message="I did not understand that request.",
            suggestions=DEFAULT_SUGGESTIONS,
        )
