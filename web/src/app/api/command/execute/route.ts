import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.OPENWHISPER_BACKEND_URL || "http://localhost:8000";

/**
 * POST /api/command/execute
 *
 * Thin proxy to backend /v1/command/execute.
 * Backend handles all extension detection, routing, and execution.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      command,
      selectedText = "",
      provider = "groq",
      groqApiKey,
      openaiApiKey,
      ollamaUrl,
      tavilyApiKey,
    } = body;

    const res = await fetch(`${BACKEND_URL}/v1/command/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        command,
        selected_text: selectedText,
        provider,
        groq_api_key: groqApiKey || "",
        openai_api_key: openaiApiKey || "",
        ollama_url: ollamaUrl || "",
        tavily_api_key: tavilyApiKey || "",
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail || "Command failed" },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Command failed";
    console.error("Command execute error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
