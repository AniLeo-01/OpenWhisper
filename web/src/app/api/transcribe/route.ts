import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.OPENWHISPER_BACKEND_URL || "http://localhost:8000";

/**
 * POST /api/transcribe
 *
 * Proxies audio to the backend for transcription.
 *
 * For Groq cloud STT: proxies to Groq Whisper API directly.
 * For self-hosted: proxies to the backend pipeline endpoint.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const engine = (formData.get("engine") as string) || "groq";
    const language = (formData.get("language") as string) || "auto";
    const groqApiKey = formData.get("groqApiKey") as string;
    const selfHostedUrl = formData.get("selfHostedUrl") as string;
    const dictionary = formData.get("dictionary") as string;
    const previousContext = (formData.get("previous_context") as string) || "";
    const provider = (formData.get("provider") as string) || "groq";
    const tone = (formData.get("tone") as string) || "auto";
    const postProcess = (formData.get("post_process") as string) || "true";
    const openaiApiKey = (formData.get("openaiApiKey") as string) || "";
    const ollamaUrl = (formData.get("ollamaUrl") as string) || "";

    if (!file) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    if (engine === "groq") {
      // Groq cloud STT: send to Groq Whisper API, then use backend pipeline for post-processing
      if (!groqApiKey) {
        return NextResponse.json(
          { error: "Groq API key is required. Add it in Settings." },
          { status: 400 }
        );
      }

      // Step 1: Transcribe via Groq
      const groqForm = new FormData();
      groqForm.append("file", file, "audio.wav");
      groqForm.append("model", "whisper-large-v3");
      groqForm.append("response_format", "verbose_json");
      if (language && language !== "auto") {
        groqForm.append("language", language);
      }

      const groqRes = await fetch(
        "https://api.groq.com/openai/v1/audio/transcriptions",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${groqApiKey}` },
          body: groqForm,
        }
      );

      if (!groqRes.ok) {
        const err = await groqRes.text();
        throw new Error(`Groq API error (${groqRes.status}): ${err}`);
      }

      const groqData = await groqRes.json();
      const rawText = (groqData.text || "").trim();

      // Step 2: Post-process via backend (if enabled)
      if (postProcess === "true" && provider !== "none" && rawText) {
        try {
          const processRes = await fetch(`${BACKEND_URL}/v1/process`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: rawText,
              previous_context: previousContext,
              provider,
              tone,
              dictionary: dictionary ? dictionary.split(",").map((w: string) => w.trim()).filter(Boolean) : [],
              groq_api_key: groqApiKey,
              openai_api_key: openaiApiKey,
              ollama_url: ollamaUrl,
            }),
          });

          if (processRes.ok) {
            const processed = await processRes.json();
            return NextResponse.json({
              id: crypto.randomUUID(),
              raw_text: rawText,
              cleaned_text: (processed.text || rawText).trim(),
              language: groqData.language || language,
              duration_ms: 0,
            });
          }
        } catch {
          // Fall through to return raw text
        }
      }

      return NextResponse.json({
        id: crypto.randomUUID(),
        raw_text: rawText,
        cleaned_text: rawText,
        language: groqData.language || language,
        duration_ms: 0,
      });
    }

    // Self-hosted: proxy to backend pipeline endpoint
    const url = process.env.WHISPER_SERVER_INTERNAL_URL || selfHostedUrl || BACKEND_URL;

    const backendForm = new FormData();
    backendForm.append("file", file, "audio.wav");
    backendForm.append("language", language);
    backendForm.append("provider", provider);
    backendForm.append("tone", tone);
    backendForm.append("post_process", postProcess);
    backendForm.append("previous_context", previousContext || "");
    backendForm.append("dictionary", dictionary || "");
    backendForm.append("groq_api_key", groqApiKey || "");
    backendForm.append("openai_api_key", openaiApiKey || "");
    backendForm.append("ollama_url", ollamaUrl || "");

    const res = await fetch(`${url}/v1/transcribe/pipeline`, {
      method: "POST",
      body: backendForm,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Backend error (${res.status}): ${err}`);
    }

    return NextResponse.json(await res.json());
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Transcription failed";
    console.error("Transcription error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
