"""
Local Whisper transcription service using faster-whisper.

faster-whisper uses CTranslate2 for 4x faster inference than OpenAI's Whisper
with lower memory usage and comparable accuracy.
"""

import io
import logging
import time

import numpy as np
import soundfile as sf
from faster_whisper import WhisperModel

from app.config import settings

logger = logging.getLogger(__name__)

# ─── Lazy-loaded global model ────────────────────────────────────────

_model: WhisperModel | None = None


def get_model() -> WhisperModel:
    """Load the Whisper model (lazy singleton)."""
    global _model
    if _model is None:
        logger.info(
            f"Loading Whisper model '{settings.whisper_model}' "
            f"on device={settings.whisper_device}, compute={settings.whisper_compute_type}"
        )
        _model = WhisperModel(
            settings.whisper_model,
            device=settings.whisper_device,
            compute_type=settings.whisper_compute_type,
        )
        logger.info("Whisper model loaded successfully")
    return _model


def is_model_loaded() -> bool:
    return _model is not None


def preload_model() -> None:
    """Pre-load the model at startup (optional, called in lifespan)."""
    get_model()


# ─── Hallucination Filter ───────────────────────────────────────────
#
# Whisper hallucinates these phrases on silent or near-silent audio.
# They come from its YouTube training data. If the ENTIRE transcription
# is one of these (after trimming), we discard it as a false positive.

HALLUCINATION_PHRASES = {
    "thank you",
    "thanks",
    "thanks for watching",
    "thank you for watching",
    "thanks for listening",
    "thank you for listening",
    "bye",
    "bye bye",
    "goodbye",
    "see you next time",
    "see you",
    "subscribe",
    "please subscribe",
    "like and subscribe",
    "you",
    "the end",
    "i'll see you in the next video",
    "thanks for watching guys",
    "peace",
    "...",
    "…",
    ".",
    "",
    "you know",
    "so",
    "okay",
    "oh",
    "hmm",
    "uh",
    "um",
    "subtitles by the amara.org community",
    "amara.org",
    "copyright",
    "music",
    "♪",
    "🎵",
}


def is_hallucination(text: str) -> bool:
    """Returns True if the transcription looks like a Whisper hallucination."""
    cleaned = text.strip().lower().replace(r"[.,!?;:\s]+$", "")
    if not cleaned:
        return True
    if cleaned in HALLUCINATION_PHRASES:
        return True
    # Very short transcriptions that are common hallucinations
    words = cleaned.split()
    if len(words) <= 2 and len(cleaned) < 15:
        filler_re = (
            "hey", "hi", "hello", "yo", "ok", "okay", "yeah", "yep",
            "nah", "no", "yes", "sure", "right", "huh", "hmm", "oh", "ah", "uh", "um",
        )
        if words[0] in filler_re and len(words) == 1:
            return True
    return False


# ─── Transcription ───────────────────────────────────────────────────


async def transcribe_audio(
    audio_bytes: bytes,
    language: str | None = None,
    prompt: str | None = None,
) -> tuple[str, str, int]:
    """
    Transcribe audio bytes using faster-whisper.

    Args:
        audio_bytes: Raw audio file bytes (webm, wav, mp3, etc.)
        language: ISO language code or None for auto-detect
        prompt: Context prompt (e.g., personal dictionary words)

    Returns:
        Tuple of (transcribed_text, detected_language, duration_ms)
    """
    start = time.monotonic()
    model = get_model()

    # Convert bytes to numpy array via soundfile
    audio_array, sample_rate = _bytes_to_array(audio_bytes)

    # Resample to 16kHz if needed (Whisper expects 16kHz)
    if sample_rate != 16000:
        audio_array = _resample(audio_array, sample_rate, 16000)

    # Transcribe
    kwargs: dict = {}
    if language and language != "auto":
        kwargs["language"] = language
    if prompt:
        kwargs["initial_prompt"] = prompt

    segments, info = model.transcribe(audio_array, **kwargs)
    text = " ".join(seg.text for seg in segments).strip()

    duration_ms = int((time.monotonic() - start) * 1000)
    detected_lang = info.language if info else (language or "unknown")

    logger.info(
        f"Transcribed {len(text)} chars in {duration_ms}ms "
        f"(lang={detected_lang}, model={settings.whisper_model})"
    )

    return text, detected_lang, duration_ms


# ─── Audio Helpers ───────────────────────────────────────────────────


def _bytes_to_array(audio_bytes: bytes) -> tuple[np.ndarray, int]:
    """Convert raw audio bytes to numpy float32 array + sample rate."""
    buf = io.BytesIO(audio_bytes)
    data, sr = sf.read(buf, dtype="float32")
    # Convert stereo to mono if needed
    if data.ndim > 1:
        data = data.mean(axis=1)
    return data, sr


def _resample(audio: np.ndarray, orig_sr: int, target_sr: int) -> np.ndarray:
    """Simple resampling via linear interpolation."""
    if orig_sr == target_sr:
        return audio
    duration = len(audio) / orig_sr
    target_len = int(duration * target_sr)
    indices = np.linspace(0, len(audio) - 1, target_len)
    return np.interp(indices, np.arange(len(audio)), audio).astype(np.float32)
