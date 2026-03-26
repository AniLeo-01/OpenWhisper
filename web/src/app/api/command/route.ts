import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.OPENWHISPER_BACKEND_URL || "http://localhost:8000";

/**
 * POST /api/command
 *
 * Thin proxy to backend /v1/command.
 * All AI processing happens on the backend.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      selectedText,
      command,
      provider = "groq",
      groqApiKey,
      openaiApiKey,
      ollamaUrl,
    } = body;

    const res = await fetch(`${BACKEND_URL}/v1/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selected_text: selectedText,
        command,
        provider,
        groq_api_key: groqApiKey || "",
        openai_api_key: openaiApiKey || "",
        ollama_url: ollamaUrl || "",
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
    console.error("Command mode error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
