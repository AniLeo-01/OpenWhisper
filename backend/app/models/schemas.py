"""
Pydantic models for API request/response schemas.
"""

from pydantic import BaseModel


# ─── Transcription ────────────────────────────────────────────────────

class TranscriptionResponse(BaseModel):
    text: str
    language: str
    duration_ms: int


# ─── Post-Processing ─────────────────────────────────────────────────

class ProcessRequest(BaseModel):
    text: str
    provider: str = "groq"  # groq, openai, ollama, none
    tone: str = "auto"  # auto, casual, professional, technical
    dictionary: list[str] = []


class ProcessResponse(BaseModel):
    text: str


# ─── Command Mode ────────────────────────────────────────────────────

class CommandRequest(BaseModel):
    selected_text: str
    command: str
    provider: str = "groq"


class CommandResponse(BaseModel):
    text: str


# ─── Health ──────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    whisper_model: str
    whisper_loaded: bool
    version: str
