"""
/v1/command/execute — Unified command mode endpoint.

Detects what type of command was spoken (search, transform, etc.)
and routes to the appropriate extension. This is the single entry
point for all command mode operations.
"""

import logging

from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    CommandExecuteRequest,
    CommandExecuteResponse,
)
from app.services.ai import run_command
from app.services.extensions import detect_extension, extract_search_query
from app.services.search import web_search

logger = logging.getLogger(__name__)

router = APIRouter(tags=["command"])


@router.post("/v1/command/execute", response_model=CommandExecuteResponse)
async def execute_command(req: CommandExecuteRequest):
    """
    Execute a voice command through the extension system.

    The backend detects the intent (search vs transform) and routes
    to the appropriate handler. Frontend only sends raw data.
    """
    if not req.command or not req.command.strip():
        raise HTTPException(status_code=400, detail="Command is required")

    has_selected_text = bool(req.selected_text and req.selected_text.strip())
    extension = await detect_extension(
        req.command,
        has_selected_text,
        provider=req.provider,
        groq_api_key=req.groq_api_key,
        openai_api_key=req.openai_api_key,
        ollama_url=req.ollama_url,
    )

    logger.info(f"Command detected as '{extension}': {req.command!r}")

    try:
        if extension == "none":
            return CommandExecuteResponse(
                type="text",
                text=None,
            )

        if extension == "search":
            query = extract_search_query(req.command)
            result = await web_search(
                query=query,
                api_key=req.tavily_api_key or None,
            )
            return CommandExecuteResponse(
                type="search",
                query=result["query"],
                answer=result.get("answer"),
                results=result.get("results", []),
                response_time=result.get("response_time", 0),
            )

        elif extension == "transform":
            if not has_selected_text:
                return CommandExecuteResponse(
                    type="text",
                    text="No text selected. Select text first, then use a transform command.",
                )

            transformed = await run_command(
                selected_text=req.selected_text,
                command=req.command,
                provider=req.provider,
                groq_api_key=req.groq_api_key,
                openai_api_key=req.openai_api_key,
                ollama_url=req.ollama_url,
            )
            return CommandExecuteResponse(type="text", text=transformed)

        else:
            raise HTTPException(status_code=400, detail=f"Unknown extension: {extension}")

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Command execution failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
