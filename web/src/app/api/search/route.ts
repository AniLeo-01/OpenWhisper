import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/search
 *
 * Web search via Tavily API. Proxies to backend if self-hosted,
 * or calls Tavily directly for cloud mode.
 *
 * Body: {
 *   query: string,
 *   tavilyApiKey?: string,
 *   selfHostedUrl?: string,
 *   sttEngine?: string,
 *   maxResults?: number,
 *   searchDepth?: string,
 *   topic?: string,
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      query,
      tavilyApiKey,
      selfHostedUrl,
      sttEngine,
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

    // If using self-hosted backend, proxy to it
    if (sttEngine === "self-hosted" && selfHostedUrl) {
      const backendRes = await fetch(`${selfHostedUrl}/v1/search`, {
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

      if (!backendRes.ok) {
        const err = await backendRes.json().catch(() => ({ detail: "Search failed" }));
        throw new Error(err.detail || "Search failed");
      }

      const data = await backendRes.json();
      return NextResponse.json(data);
    }

    // Cloud mode: call Tavily API directly
    if (!tavilyApiKey) {
      return NextResponse.json(
        { error: "Tavily API key required. Add it in Settings." },
        { status: 400 }
      );
    }

    const tavilyRes = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tavilyApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        search_depth: searchDepth,
        topic,
        max_results: maxResults,
        include_answer: true,
      }),
    });

    if (!tavilyRes.ok) {
      const errText = await tavilyRes.text();
      throw new Error(`Tavily error: ${errText}`);
    }

    const data = await tavilyRes.json();

    return NextResponse.json({
      query: data.query,
      answer: data.answer || null,
      results: (data.results || []).map(
        (r: { title: string; url: string; content: string; score: number }) => ({
          title: r.title,
          url: r.url,
          content: r.content,
          score: r.score,
        })
      ),
      response_time: data.response_time || 0,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Search failed";
    console.error("Search error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
