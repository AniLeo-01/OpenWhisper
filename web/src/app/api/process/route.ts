import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.OPENWHISPER_BACKEND_URL || "http://localhost:8000";

/**
 * POST /api/process
 *
 * Thin proxy to backend /v1/process.
 * All AI post-processing happens on the backend.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      text,
      previousContext = "",
      provider = "none",
      tone = "auto",
      groqApiKey,
      openaiApiKey,
      ollamaUrl,
      dictionary = [],
    } = body;

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ text: "" });
    }

    if (provider === "none") {
      return NextResponse.json({ text });
    }

    const res = await fetch(`${BACKEND_URL}/v1/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        previous_context: previousContext,
        provider,
        tone,
        dictionary,
        groq_api_key: groqApiKey || "",
        openai_api_key: openaiApiKey || "",
        ollama_url: ollamaUrl || "",
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail || "Processing failed" },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Processing failed";
    console.error("Post-processing error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
