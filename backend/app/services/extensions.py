"""
Extension detection and routing service.

Determines which extension a voice command should route to (search, transform, etc.)
and extracts relevant parameters. Uses an LLM call to classify intent, avoiding
false positives from transcription artifacts like filler words.
"""

import logging

from app.services.ai import call_ai

logger = logging.getLogger(__name__)


# ─── Classification Prompt ───────────────────────────────────────────


def _build_classify_prompt(command: str, has_selected_text: bool) -> str:
    """Build the prompt for LLM-based command classification."""
    context = "The user HAS selected text." if has_selected_text else "The user has NOT selected any text."
    return f"""You are a command classifier for a voice dictation app. The user spoke a voice command and you must classify it.

{context}

The voice command is:
\"\"\"{command}\"\"\"

Classify this command into exactly ONE of these categories:
- "search" — the user wants to search the web for information (e.g., "search for Python tutorials", "what is quantum computing", "look up the weather")
- "transform" — the user wants to transform/edit the selected text (e.g., "make it uppercase", "translate to Spanish", "summarize this", "fix the grammar")
- "none" — the input is NOT a valid command. It is noise, filler words, gibberish, or an accidental recording (e.g., "uh", "um", "hmm", "", random syllables)

Rules:
1. If the input is just filler words, very short gibberish, or clearly not an intentional command, classify as "none"
2. If the user has selected text and gives a transformation instruction, classify as "transform"
3. Only classify as "search" if the user clearly wants to look something up on the web

Respond with ONLY one word: search, transform, or none"""


# ─── Detection ───────────────────────────────────────────────────────


async def detect_extension(
    command: str,
    has_selected_text: bool,
    provider: str | None = None,
    groq_api_key: str = "",
    openai_api_key: str = "",
    ollama_url: str = "",
) -> str:
    """
    Detect which extension a command should route to using LLM classification.

    Returns:
        "search" — web search via Tavily
        "transform" — text transformation via AI
        "none" — not a valid command (noise/filler)
    """
    prompt = _build_classify_prompt(command, has_selected_text)

    try:
        result = await call_ai(prompt, provider, groq_api_key, openai_api_key, ollama_url)
        classification = result.strip().lower().rstrip(".")

        if classification in ("search", "transform", "none"):
            return classification

        # LLM returned something unexpected — fall back to heuristic
        logger.warning(f"Unexpected classification result: {result!r}, falling back to heuristic")
    except Exception as e:
        logger.warning(f"LLM classification failed: {e}, falling back to heuristic")

    # Heuristic fallback if LLM fails
    if has_selected_text:
        return "transform"
    return "search"


def extract_search_query(command: str) -> str:
    """
    Strip common search prefixes from a command to get the raw search query.

    E.g., "search for latest AI news" → "latest AI news"
    """
    lower = command.lower()

    prefixes = [
        "web search for",
        "web search",
        "search for",
        "search",
        "look up",
        "google",
    ]

    # Sort by length descending so longer prefixes match first
    sorted_prefixes = sorted(prefixes, key=len, reverse=True)

    for prefix in sorted_prefixes:
        if lower.startswith(prefix):
            rest = command[len(prefix):].strip()
            return rest if rest else command

    return command
