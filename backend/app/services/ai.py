"""
AI post-processing service.

Cleans up raw transcriptions by removing filler words, fixing grammar,
handling self-corrections, and adjusting tone. Supports multiple providers:
Groq (Llama 3.3), OpenAI (GPT-4o-mini), or Ollama (local).

All functions accept optional per-request API keys that take priority
over environment variable keys. This allows the frontend to forward
user-provided keys without requiring server-side configuration.
"""

import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# ─── Tone instructions ───────────────────────────────────────────────

TONE_INSTRUCTIONS = {
    "auto": "Match the natural tone of the text.",
    "casual": "Make it casual and conversational. Use contractions. Keep it short and friendly.",
    "professional": "Make it professional and polished. Use complete sentences. Formal but not stiff.",
    "technical": "Keep technical terms exactly as spoken. Use precise language. Preserve code-related terms.",
}


# ─── Prompt Builder ──────────────────────────────────────────────────


def build_cleanup_prompt(
    text: str,
    tone: str = "auto",
    dictionary: list[str] | None = None,
    previous_context: str = "",
) -> str:
    """Build the AI cleanup prompt for a raw transcription, with optional session context."""
    tone_inst = TONE_INSTRUCTIONS.get(tone, TONE_INSTRUCTIONS["auto"])
    dict_note = ""
    if dictionary:
        dict_note = (
            f"\nThe user has a personal dictionary. If any of these words appear in the "
            f"dictation, preserve their exact spelling: {', '.join(dictionary)}. "
            f"If these words do NOT appear in the dictation, ignore them completely — "
            f"do NOT mention them or add them."
        )

    context_block = ""
    if previous_context and previous_context.strip():
        context_block = f"""
Previously dictated text (for context only — do NOT include this in your output):
\"\"\"\n{previous_context.strip()}\n\"\"\"
Use this context only to understand tone, resolve pronouns, and ensure continuity."""

    return f"""You are a text cleanup tool. Your ONLY job is to output the cleaned version of the dictated text below. You must NEVER output explanations, reasoning, commentary, notes, or meta-text. You must NEVER discuss what you changed or why. Your entire response must be ONLY the cleaned text and nothing else.

Rules:
1. Remove filler words: um, uh, like, you know, so, basically, I mean, right, actually
2. Fix grammar, punctuation, and capitalization
3. Handle self-corrections: "no wait", "I mean", "actually" → keep only the final intent
4. Do NOT add any words, sentences, or information that the speaker did not say
5. Do NOT remove meaningful content — only remove filler and fix grammar
6. If the transcription contains garbled/nonsense fragments at the very end (artifacts from speech recognition), silently remove them
7. {tone_inst}{dict_note}
{context_block}
Dictated text to clean:
\"\"\"
{text}
\"\"\"

Cleaned text:"""


def build_command_prompt(selected_text: str, command: str) -> str:
    """Build the prompt for Command Mode (text transformation)."""
    return f"""You are a text transformation assistant. The user has selected text and given a voice command to transform it.

Selected text:
\"\"\"
{selected_text}
\"\"\"

Voice command: "{command}"

Apply the voice command to transform the selected text. Return ONLY the transformed text. No explanations, no quotes, no prefixes."""


# ─── Provider Calls ──────────────────────────────────────────────────


async def call_ai(
    prompt: str,
    provider: str | None = None,
    groq_api_key: str = "",
    openai_api_key: str = "",
    ollama_url: str = "",
) -> str:
    """
    Call the configured AI provider with a prompt.

    Per-request API keys take priority over environment variable keys.
    """
    provider = provider or settings.default_ai_provider

    if provider == "none":
        return ""

    match provider:
        case "groq":
            return await _call_groq(prompt, groq_api_key)
        case "openai":
            return await _call_openai(prompt, openai_api_key)
        case "ollama":
            return await _call_ollama(prompt, ollama_url)
        case _:
            logger.warning(f"Unknown AI provider: {provider}")
            return ""


async def _call_groq(prompt: str, request_key: str = "") -> str:
    api_key = request_key or settings.groq_api_key
    if not api_key:
        raise ValueError("Groq API key required — set OPENWHISPER_GROQ_API_KEY or provide in Settings")

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
                "max_tokens": 2048,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()


async def _call_openai(prompt: str, request_key: str = "") -> str:
    api_key = request_key or settings.openai_api_key
    if not api_key:
        raise ValueError("OpenAI API key required — set OPENWHISPER_OPENAI_API_KEY or provide in Settings")

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
                "max_tokens": 2048,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()


async def _call_ollama(prompt: str, request_url: str = "") -> str:
    url = request_url or settings.ollama_url
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{url}/api/generate",
            json={
                "model": settings.ollama_model,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.1},
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("response", "").strip()


# ─── High-Level Functions ────────────────────────────────────────────


async def clean_transcription(
    text: str,
    tone: str = "auto",
    dictionary: list[str] | None = None,
    provider: str | None = None,
    previous_context: str = "",
    groq_api_key: str = "",
    openai_api_key: str = "",
    ollama_url: str = "",
) -> str:
    """Clean a raw transcription using AI post-processing, with optional session context."""
    if not text or not text.strip():
        return text

    prompt = build_cleanup_prompt(text, tone, dictionary, previous_context)
    result = await call_ai(prompt, provider, groq_api_key, openai_api_key, ollama_url)
    return result or text  # Fall back to raw text if AI fails


async def run_command(
    selected_text: str,
    command: str,
    provider: str | None = None,
    groq_api_key: str = "",
    openai_api_key: str = "",
    ollama_url: str = "",
) -> str:
    """Run a Command Mode transformation on selected text."""
    prompt = build_command_prompt(selected_text, command)
    return await call_ai(prompt, provider, groq_api_key, openai_api_key, ollama_url)
