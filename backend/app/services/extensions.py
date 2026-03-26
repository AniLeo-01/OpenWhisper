"""
Extension detection and routing service.

Determines which extension a voice command should route to (search, transform, etc.)
and extracts relevant parameters. This is the core business logic for command mode.
"""

import logging

logger = logging.getLogger(__name__)

# ─── Trigger Patterns ────────────────────────────────────────────────

SEARCH_TRIGGERS = [
    "search for",
    "search",
    "look up",
    "find",
    "what is",
    "what are",
    "who is",
    "who are",
    "how to",
    "how do",
    "how does",
    "google",
    "web search for",
    "web search",
]

TRANSFORM_TRIGGERS = [
    "transform",
    "make it",
    "make this",
    "rewrite",
    "change",
    "convert",
    "translate",
    "fix",
    "improve",
    "summarize",
    "expand",
    "shorten",
]


# ─── Detection ───────────────────────────────────────────────────────


def detect_extension(command: str, has_selected_text: bool) -> str:
    """
    Detect which extension a command should route to.

    Returns:
        "search" — web search via Tavily
        "transform" — text transformation via AI
    """
    lower = command.lower().strip()

    # Check search triggers first (more specific)
    for trigger in SEARCH_TRIGGERS:
        if lower.startswith(trigger):
            return "search"

    # Check transform triggers
    for trigger in TRANSFORM_TRIGGERS:
        if lower.startswith(trigger):
            return "transform"

    # Fallback: if text is selected, assume transform; otherwise search
    if has_selected_text:
        return "transform"

    return "search"


def extract_search_query(command: str) -> str:
    """
    Strip trigger prefix from a command to get the raw search query.

    E.g., "search for latest AI news" → "latest AI news"
    """
    lower = command.lower()

    # Sort by length descending so longer prefixes match first
    sorted_triggers = sorted(SEARCH_TRIGGERS, key=len, reverse=True)

    for trigger in sorted_triggers:
        if lower.startswith(trigger):
            rest = command[len(trigger):].strip()
            return rest if rest else command

    return command
