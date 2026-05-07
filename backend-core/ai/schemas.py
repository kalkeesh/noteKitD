from __future__ import annotations

from typing import Any, Dict, Literal

from pydantic import BaseModel, Field


AssistantIntentType = Literal["chat", "action", "unknown"]
AssistantActionName = Literal[
    "create_note",
    "update_note",
    "delete_note",
    "create_task",
    "update_task",
    "delete_task",
    "add_expense",
    "unknown",
]


class AssistantParsedCommand(BaseModel):
    action: AssistantActionName = "unknown"
    data: Dict[str, Any] = Field(default_factory=dict)
    missing_fields: list[str] = Field(default_factory=list)
    follow_up_question: str = ""


class AssistantConversationContext(BaseModel):
    pending_command: AssistantParsedCommand | None = None


class AssistantChatRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)
    context: Dict[str, Any] | None = None


class AssistantCommandResponse(BaseModel):
    ok: bool = False
    intent_type: AssistantIntentType = "unknown"
    transcript: str = ""
    parsed_command: AssistantParsedCommand | None = None
    message: str = (
        "I couldn't understand. Try something like: create a note titled meeting notes."
    )
    resource_type: str = ""
    operation: str = ""
    resource: Dict[str, Any] | None = None
    needs_follow_up: bool = False
    missing_fields: list[str] = Field(default_factory=list)
    follow_up_question: str = ""
    suggestions: list[str] = Field(default_factory=list)
    cleanup_notification_ids: list[str] = Field(default_factory=list)


class AssistantTranscriptionResponse(BaseModel):
    ok: bool = False
    text: str = ""
    message: str = ""
    file_size_bytes: int = 0
