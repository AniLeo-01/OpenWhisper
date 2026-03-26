import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.OPENWHISPER_BACKEND_URL || "http://localhost:8000";

/**
 * POST /api/search
 *
 * Thin proxy to backend /v1/search.
 * All Tavily search logic happens on the backend.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      query,
      tavilyApiKey,
      maxResults = 5,
      searchDepth = "basic",
      topic = "general",
    } = body;

    if (!query?.trim()) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    const res = await fetch(`${BACKEND_URL}/v1/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        max_results: maxResults,
        search_depth: searchDepth,
        topic,
        tavily_api_key: tavilyApiKey || "",
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail || "Search failed" },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Search failed";
    console.error("Search error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
