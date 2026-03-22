"""
/v1/process — AI post-processing endpoint.
/v1/command — Command Mode endpoint.

Handles text cleanup (filler removal, grammar, tone) and
Command Mode transformations (rewrite, translate, format).
"""

import logging

from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    CommandRequest,
    CommandResponse,
    ProcessRequest,
    ProcessResponse,
)
from app.services.ai import clean_transcription, run_command

logger = logging.getLogger(__name__)

router = APIRouter(tags=["processing"])


@router.post("/v1/process", response_model=ProcessResponse)
async def process_text(req: ProcessRequest):
    """
    Clean up raw transcription text using AI post-processing.

    Removes filler words, fixes grammar, handles self-corrections,
    and adjusts tone based on context.
    """
    if not req.text or not req.text.strip():
        return ProcessResponse(text="")

    if req.provider == "none":
        return ProcessResponse(text=req.text)

    try:
        cleaned = await clean_transcription(
            text=req.text,
            tone=req.tone,
            dictionary=req.dictionary or None,
            provider=req.provider,
            previous_context=req.previous_context,
        )
        return ProcessResponse(text=cleaned)
    except Exception as e:
        logger.error(f"Post-processing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/v1/command", response_model=CommandResponse)
async def command_mode(req: CommandRequest):
    """
    Command Mode: transform selected text using a voice command.

    Examples:
      - "make this more concise"
      - "translate to Spanish"
      - "rewrite as bullet points"
      - "make it sound more professional"
    """
    if not req.selected_text or not req.command:
        raise HTTPException(status_code=400, detail="Both selected_text and command are required")

    try:
        result = await run_command(
            selected_text=req.selected_text,
            command=req.command,
            provider=req.provider,
        )
        return CommandResponse(text=result)
    except Exception as e:
        logger.error(f"Command mode failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
