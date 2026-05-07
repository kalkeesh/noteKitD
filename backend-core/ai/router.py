from __future__ import annotations

import json

from fastapi import APIRouter, Depends, File, Form, UploadFile

from authent import get_current_user

from .schemas import AssistantChatRequest, AssistantCommandResponse, AssistantTranscriptionResponse
from .ai_agent_service import AssistantService


router = APIRouter(prefix="/ai", tags=["Assistant"])
service = AssistantService()


@router.post("/chat", response_model=AssistantCommandResponse)
async def ai_chat(
    payload: AssistantChatRequest,
    current_user=Depends(get_current_user),
):
    return await service.handle_command(
        current_user=current_user,
        text=payload.text,
        context_json=json.dumps(payload.context) if payload.context else None,
    )


@router.post("/voice-command", response_model=AssistantCommandResponse)
async def voice_command(
    text: str | None = Form(default=None),
    audio: UploadFile | None = File(default=None),
    context_json: str | None = Form(default=None),
    current_user=Depends(get_current_user),
):
    return await service.handle_command(
        current_user=current_user,
        text=text,
        audio=audio,
        context_json=context_json,
    )


@router.post("/transcribe", response_model=AssistantTranscriptionResponse)
async def transcribe_audio(
    audio: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    del current_user
    return await service.transcribe_upload(audio)
