"""
OpenWhisper Backend — FastAPI server for self-hosted voice dictation.

Provides:
  - /v1/audio/transcriptions — Local Whisper STT (OpenAI-compatible)
  - /v1/process — AI post-processing (filler removal, grammar, tone)
  - /v1/command — Command Mode (text transformation via voice)
  - /health — Server health check
"""

import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.models.schemas import HealthResponse
from app.routers import process, transcribe
from app.services.whisper import is_model_loaded, preload_model

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ─── Lifespan ────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Pre-load the Whisper model at startup so the first request is fast."""
    logger.info(f"Starting OpenWhisper Backend v0.1.0")
    logger.info(f"Whisper model: {settings.whisper_model}")
    logger.info(f"AI provider: {settings.default_ai_provider}")

    try:
        preload_model()
    except Exception as e:
        logger.warning(f"Could not pre-load Whisper model: {e}")
        logger.warning("Model will be loaded on first transcription request")

    yield

    logger.info("Shutting down OpenWhisper Backend")


# ─── App ─────────────────────────────────────────────────────────────

app = FastAPI(
    title="OpenWhisper Backend",
    description="Self-hosted STT + AI post-processing server for OpenWhisper",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(transcribe.router)
app.include_router(process.router)


# ─── Health Check ────────────────────────────────────────────────────


@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        whisper_model=settings.whisper_model,
        whisper_loaded=is_model_loaded(),
        version="0.1.0",
    )


# ─── Entry Point ─────────────────────────────────────────────────────


def run():
    """Run the server (used by pyproject.toml script entry)."""
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    run()
