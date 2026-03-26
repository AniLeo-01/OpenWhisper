"""
/v1/search — Web search endpoint using Tavily API.
"""

import logging

from fastapi import APIRouter, HTTPException

from app.models.schemas import SearchRequest, SearchResponse
from app.services.search import web_search

logger = logging.getLogger(__name__)

router = APIRouter(tags=["search"])


@router.post("/v1/search", response_model=SearchResponse)
async def search(req: SearchRequest):
    """
    Search the web using Tavily API.

    Returns relevant results with an optional AI-generated answer.
    """
    if not req.query or not req.query.strip():
        raise HTTPException(status_code=400, detail="Query is required")

    try:
        result = await web_search(
            query=req.query,
            max_results=req.max_results,
            search_depth=req.search_depth,
            topic=req.topic,
            api_key=req.tavily_api_key or None,
        )
        return SearchResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
