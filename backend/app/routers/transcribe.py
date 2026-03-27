"""
/v1/audio/transcriptions — Whisper-compatible transcription endpoint.
/v1/transcribe/pipeline — Full transcription pipeline (transcribe + filter + post-process).

Accepts audio files and returns transcribed text.
Compatible with OpenAI's Whisper API format so the Next.js frontend
can point to this server as a drop-in replacement for Groq.
"""

import logging
import uuid

from fastapi import APIRouter, File, Form, UploadFile

from app.models.schemas import TranscriptionPipelineResponse, TranscriptionResponse
from app.services.ai import clean_transcription
from app.services.whisper import is_hallucination, transcribe_audio_whisper

logger = logging.getLogger(__name__)

router = APIRouter(tags=["transcription"])


@router.post("/v1/audio/transcriptions", response_model=TranscriptionResponse)
async def transcribe(
    file: UploadFile = File(..., description="Audio file (webm, wav, mp3, etc.)"),
    language: str = Form("", description="ISO language code or empty for auto-detect"),
    prompt: str = Form("", description="Context prompt (personal dictionary words)"),
    model: str = Form(
        "whisper-large-v3", description="Model name (ignored, uses configured model)"
    ),
):
    """
    Transcribe audio using the local faster-whisper model.

    This endpoint is compatible with OpenAI's /v1/audio/transcriptions format,
    meaning the Next.js frontend can use the same code to call either Groq or
    this self-hosted server.
    """
    audio_bytes = await file.read()
    lang = language if language and language != "auto" else None

    text, detected_lang, duration_ms = await transcribe_audio_whisper(
        audio_bytes=audio_bytes,
        language=lang,
        prompt=prompt or None,
    )

    return TranscriptionResponse(
        text=text,
        language=detected_lang,
        duration_ms=duration_ms,
    )


@router.post("/v1/transcribe/pipeline", response_model=TranscriptionPipelineResponse)
async def transcribe_pipeline(
    file: UploadFile = File(..., description="Audio file"),
    language: str = Form("auto"),
    provider: str = Form("groq"),
    tone: str = Form("auto"),
    post_process: str = Form("true"),
    previous_context: str = Form(""),
    dictionary: str = Form(""),
    groq_api_key: str = Form(""),
    openai_api_key: str = Form(""),
    ollama_url: str = Form(""),
):
    """
    Full transcription pipeline: transcribe → filter hallucinations → post-process.

    Returns a complete entry with both raw and cleaned text.
    The frontend sends audio + settings; the backend orchestrates everything.
    """
    audio_bytes = await file.read()
    lang = language if language and language != "auto" else None

    # Build Whisper prompt from session context (last ~800 chars)
    whisper_prompt = ""
    if previous_context and previous_context.strip():
        trimmed = previous_context.strip()
        whisper_prompt = trimmed[-800:] if len(trimmed) > 800 else trimmed

    # Step 1: Transcribe
    text, detected_lang, duration_ms = await transcribe_audio(
        audio_bytes=audio_bytes,
        language=lang,
        prompt=whisper_prompt or None,
    )

    # Step 2: Filter hallucinations
    if is_hallucination(text):
        return TranscriptionPipelineResponse(
            id=str(uuid.uuid4()),
            raw_text="",
            cleaned_text="",
            language=detected_lang or language,
            duration_ms=duration_ms,
            filtered=True,
        )

    # Step 3: Post-process with AI (if enabled)
    cleaned_text = text
    should_process = post_process.lower() == "true" and provider != "none" and text.strip()

    if should_process:
        try:
            dict_list = (
                [w.strip() for w in dictionary.split(",") if w.strip()] if dictionary else None
            )
            cleaned_text = await clean_transcription(
                text=text,
                tone=tone,
                dictionary=dict_list,
                provider=provider,
                previous_context=previous_context,
                groq_api_key=groq_api_key,
                openai_api_key=openai_api_key,
                ollama_url=ollama_url,
            )
        except Exception as e:
            logger.warning(f"Post-processing failed, using raw text: {e}")
            cleaned_text = text

    return TranscriptionPipelineResponse(
        id=str(uuid.uuid4()),
        raw_text=text,
        cleaned_text=cleaned_text.strip(),
        language=detected_lang or language,
        duration_ms=duration_ms,
    )
