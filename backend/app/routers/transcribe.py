"""
/v1/audio/transcriptions — Whisper-compatible transcription endpoint.

Accepts audio files and returns transcribed text.
Compatible with OpenAI's Whisper API format so the Next.js frontend
can point to this server as a drop-in replacement for Groq.
"""

import logging

from fastapi import APIRouter, File, Form, UploadFile

from app.models.schemas import TranscriptionResponse
from app.services.whisper import transcribe_audio

logger = logging.getLogger(__name__)

router = APIRouter(tags=["transcription"])


@router.post("/v1/audio/transcriptions", response_model=TranscriptionResponse)
async def transcribe(
    file: UploadFile = File(..., description="Audio file (webm, wav, mp3, etc.)"),
    language: str = Form("", description="ISO language code or empty for auto-detect"),
    prompt: str = Form("", description="Context prompt (personal dictionary words)"),
    model: str = Form("whisper-large-v3", description="Model name (ignored, uses configured model)"),
):
    """
    Transcribe audio using the local faster-whisper model.

    This endpoint is compatible with OpenAI's /v1/audio/transcriptions format,
    meaning the Next.js frontend can use the same code to call either Groq or
    this self-hosted server.
    """
    audio_bytes = await file.read()

    lang = language if language and language != "auto" else None

    text, detected_lang, duration_ms = await transcribe_audio(
        audio_bytes=audio_bytes,
        language=lang,
        prompt=prompt or None,
    )

    return TranscriptionResponse(
        text=text,
        language=detected_lang,
        duration_ms=duration_ms,
    )
