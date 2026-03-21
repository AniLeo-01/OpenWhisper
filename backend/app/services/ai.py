"""
AI post-processing service.

Cleans up raw transcriptions by removing filler words, fixing grammar,
handling self-corrections, and adjusting tone. Supports multiple providers:
Groq (Llama 3.3), OpenAI (GPT-4o-mini), or Ollama (local).
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


def build_cleanup_prompt(text: str, tone: str = "auto", dictionary: list[str] | None = None) -> str:
    """Build the AI cleanup prompt for a raw transcription."""
    tone_inst = TONE_INSTRUCTIONS.get(tone, TONE_INSTRUCTIONS["auto"])
    dict_note = ""
    if dictionary:
        dict_note = f"\nIMPORTANT: Preserve these custom terms exactly: {', '.join(dictionary)}"

    return f"""You are a text cleanup assistant for a voice dictation tool. Clean up the following dictated text.

Rules:
- Remove filler words (um, uh, like, you know, so, basically, I mean, right, actually)
- Fix grammar, punctuation, and capitalization
- Handle self-corrections: if the speaker says "no wait", "I mean", "actually", "let me rephrase", keep only their final intent
- Do NOT add information or change the meaning
- Do NOT add greetings, sign-offs, or any text not present in the dictation
- {tone_inst}{dict_note}

Return ONLY the cleaned text. No explanations, no quotes, no prefixes.

Dictated text:
{text}"""


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


async def call_ai(prompt: str, provider: str | None = None) -> str:
    """
    Call the configured AI provider with a prompt.

    Args:
        prompt: The full prompt to send
        provider: Override provider (groq, openai, ollama)

    Returns:
        The AI response text
    """
    provider = provider or settings.default_ai_provider

    if provider == "none":
        return ""

    match provider:
        case "groq":
            return await _call_groq(prompt)
        case "openai":
            return await _call_openai(prompt)
        case "ollama":
            return await _call_ollama(prompt)
        case _:
            logger.warning(f"Unknown AI provider: {provider}")
            return ""


async def _call_groq(prompt: str) -> str:
    api_key = settings.groq_api_key
    if not api_key:
        raise ValueError("OPENWHISPER_GROQ_API_KEY not set")

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


async def _call_openai(prompt: str) -> str:
    api_key = settings.openai_api_key
    if not api_key:
        raise ValueError("OPENWHISPER_OPENAI_API_KEY not set")

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


async def _call_ollama(prompt: str) -> str:
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{settings.ollama_url}/api/generate",
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
) -> str:
    """Clean a raw transcription using AI post-processing."""
    if not text or not text.strip():
        return text

    prompt = build_cleanup_prompt(text, tone, dictionary)
    result = await call_ai(prompt, provider)
    return result or text  # Fall back to raw text if AI fails


async def run_command(
    selected_text: str,
    command: str,
    provider: str | None = None,
) -> str:
    """Run a Command Mode transformation on selected text."""
    prompt = build_command_prompt(selected_text, command)
    return await call_ai(prompt, provider)
