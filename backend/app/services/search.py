"""
Web search service using Tavily API.

Provides web search capabilities for the command mode extension system.
"""

import logging

from tavily import TavilyClient

from app.config import settings

logger = logging.getLogger(__name__)


async def web_search(
    query: str,
    max_results: int = 5,
    search_depth: str = "basic",
    topic: str = "general",
    api_key: str | None = None,
) -> dict:
    """
    Search the web using Tavily API.

    Args:
        query: The search query.
        max_results: Maximum number of results (1-20).
        search_depth: Search depth (basic, advanced, fast, ultra-fast).
        topic: Topic category (general, news, finance).
        api_key: Optional API key from frontend (takes priority over env var).

    Returns:
        Dict with query, answer, results, and response_time.
    """
    key = api_key or settings.tavily_api_key
    if not key:
        raise ValueError(
            "Tavily API key required. Set OPENWHISPER_TAVILY_API_KEY or provide it in settings."
        )

    client = TavilyClient(api_key=key)

    logger.info(f"Searching Tavily: query={query!r}, depth={search_depth}, max={max_results}")

    response = client.search(
        query=query,
        search_depth=search_depth,
        topic=topic,
        max_results=max_results,
        include_answer=True,
    )

    results = [
        {
            "title": r.get("title", ""),
            "url": r.get("url", ""),
            "content": r.get("content", ""),
            "score": r.get("score", 0.0),
        }
        for r in response.get("results", [])
    ]

    return {
        "query": response.get("query", query),
        "answer": response.get("answer"),
        "results": results,
        "response_time": response.get("response_time", 0.0),
    }
