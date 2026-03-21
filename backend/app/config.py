"""
Application configuration via environment variables.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """All settings can be overridden via environment variables."""

    # ─── Server ────────────────────────────────────────────
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # ─── Whisper (local STT) ───────────────────────────────
    whisper_model: str = "base"  # tiny, base, small, medium, large-v3
    whisper_device: str = "auto"  # auto, cpu, cuda
    whisper_compute_type: str = "auto"  # auto, float16, int8, float32

    # ─── Groq (cloud STT + AI) ─────────────────────────────
    groq_api_key: str = ""

    # ─── OpenAI (AI post-processing) ───────────────────────
    openai_api_key: str = ""

    # ─── Ollama (local AI) ─────────────────────────────────
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"

    # ─── AI Post-Processing ────────────────────────────────
    default_ai_provider: str = "groq"  # groq, openai, ollama, none
    default_tone: str = "auto"  # auto, casual, professional, technical

    model_config = {"env_prefix": "OPENWHISPER_", "env_file": ".env"}


settings = Settings()
