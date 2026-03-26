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
    previous_context: str = ""  # Already-cleaned text from earlier in session
    provider: str = "groq"  # groq, openai, ollama, none
    tone: str = "auto"  # auto, casual, professional, technical
    dictionary: list[str] = []
    # Per-request API keys (frontend-provided, take priority over env vars)
    groq_api_key: str = ""
    openai_api_key: str = ""
    ollama_url: str = ""


class ProcessResponse(BaseModel):
    text: str


# ─── Command Mode ────────────────────────────────────────────────────

class CommandRequest(BaseModel):
    selected_text: str
    command: str
    provider: str = "groq"
    # Per-request API keys (frontend-provided, take priority over env vars)
    groq_api_key: str = ""
    openai_api_key: str = ""
    ollama_url: str = ""


class CommandResponse(BaseModel):
    text: str


# ─── Unified Command Execute ─────────────────────────────────────────

class CommandExecuteRequest(BaseModel):
    command: str
    selected_text: str = ""
    provider: str = "groq"
    groq_api_key: str = ""
    openai_api_key: str = ""
    ollama_url: str = ""
    tavily_api_key: str = ""


class CommandExecuteResponse(BaseModel):
    type: str  # "search" or "text"
    # For text transforms:
    text: str | None = None
    # For search:
    query: str | None = None
    answer: str | None = None
    results: list["SearchResultItem"] | None = None
    response_time: float | None = None


# ─── Transcription Pipeline ──────────────────────────────────────────

class TranscriptionPipelineResponse(BaseModel):
    id: str
    raw_text: str
    cleaned_text: str
    language: str
    duration_ms: int
    filtered: bool = False


# ─── Search ──────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str
    max_results: int = 5
    search_depth: str = "basic"  # basic, advanced, fast, ultra-fast
    topic: str = "general"  # general, news, finance
    tavily_api_key: str = ""  # Optional frontend-provided key


class SearchResultItem(BaseModel):
    title: str
    url: str
    content: str
    score: float


class SearchResponse(BaseModel):
    query: str
    answer: str | None = None
    results: list[SearchResultItem]
    response_time: float


# ─── Health ──────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    whisper_model: str
    whisper_loaded: bool
    version: str
