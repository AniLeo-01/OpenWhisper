import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/transcribe
 *
 * Accepts audio as FormData with fields:
 *   - file: audio blob (webm/opus or wav)
 *   - engine: "groq" | "self-hosted"
 *   - language: ISO code or "auto"
 *   - groqApiKey: Groq API key (for groq engine)
 *   - selfHostedUrl: URL of self-hosted whisper server
 *
 * Returns: { text: string, language: string, duration: number }
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const engine = (formData.get("engine") as string) || "groq";
    const language = (formData.get("language") as string) || "";
    const groqApiKey = formData.get("groqApiKey") as string;
    const selfHostedUrl = formData.get("selfHostedUrl") as string;
    const dictionary = formData.get("dictionary") as string; // comma-separated custom words

    if (!file) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    const startTime = Date.now();

    if (engine === "groq") {
      return await transcribeWithGroq(file, language, groqApiKey, dictionary, startTime);
    } else {
      return await transcribeWithSelfHosted(file, language, selfHostedUrl, startTime);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Transcription failed";
    console.error("Transcription error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── Groq Whisper API ────────────────────────────────────────────────

async function transcribeWithGroq(
  file: File,
  language: string,
  apiKey: string,
  dictionary: string | null,
  startTime: number
) {
  if (!apiKey) {
    return NextResponse.json(
      { error: "Groq API key is required. Add it in Settings." },
      { status: 400 }
    );
  }

  const groqForm = new FormData();
  groqForm.append("file", file, "audio.webm");
  groqForm.append("model", "whisper-large-v3");
  groqForm.append("response_format", "json");

  if (language && language !== "auto") {
    groqForm.append("language", language);
  }

  // Inject personal dictionary as prompt context to improve recognition
  if (dictionary) {
    groqForm.append("prompt", `Context words: ${dictionary}`);
  }

  const response = await fetch(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: groqForm,
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error (${response.status}): ${err}`);
  }

  const result = await response.json();
  const duration = Date.now() - startTime;

  return NextResponse.json({
    text: result.text,
    language: language || "auto",
    duration,
  });
}

// ─── Self-Hosted Whisper Server ──────────────────────────────────────

async function transcribeWithSelfHosted(
  file: File,
  language: string,
  serverUrl: string,
  startTime: number
) {
  // In Docker, the server-side can't reach localhost — use internal URL if set
  const url = process.env.WHISPER_SERVER_INTERNAL_URL || serverUrl;

  if (!url) {
    return NextResponse.json(
      { error: "Self-hosted server URL is required. Add it in Settings." },
      { status: 400 }
    );
  }

  const form = new FormData();
  form.append("file", file, "audio.webm");
  if (language && language !== "auto") {
    form.append("language", language);
  }

  // Expects a faster-whisper compatible API (e.g., running with whisper-server or similar)
  const response = await fetch(`${url}/v1/audio/transcriptions`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Self-hosted server error (${response.status}): ${err}`);
  }

  const result = await response.json();
  const duration = Date.now() - startTime;

  return NextResponse.json({
    text: result.text,
    language: result.language || language || "auto",
    duration,
  });
}
