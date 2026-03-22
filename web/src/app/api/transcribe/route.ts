import { NextRequest, NextResponse } from "next/server";

// ─── Whisper Hallucination Filter ────────────────────────────────────
//
// Whisper hallucinates these phrases on silent or near-silent audio.
// They come from its YouTube training data. If the ENTIRE transcription
// is one of these (after trimming), we discard it as a false positive.

const HALLUCINATION_PHRASES = new Set([
  "thank you",
  "thanks",
  "thanks for watching",
  "thank you for watching",
  "thanks for listening",
  "thank you for listening",
  "bye",
  "bye bye",
  "goodbye",
  "see you next time",
  "see you",
  "subscribe",
  "please subscribe",
  "like and subscribe",
  "you",
  "the end",
  "i'll see you in the next video",
  "thanks for watching guys",
  "peace",
  "...",
  "…",
  ".",
  "",
  "you know",
  "so",
  "okay",
  "oh",
  "hmm",
  "uh",
  "um",
  "subtitles by the amara.org community",
  "amara.org",
  "copyright",
  "music",
  "♪",
  "🎵",
]);

/**
 * Returns true if the transcription looks like a Whisper hallucination.
 */
function isHallucination(text: string): boolean {
  const cleaned = text.trim().toLowerCase().replace(/[.,!?;:\s]+$/g, "");
  if (cleaned.length === 0) return true;
  if (HALLUCINATION_PHRASES.has(cleaned)) return true;
  // Very short transcriptions (< 3 real words) that are common hallucinations
  if (cleaned.split(/\s+/).length <= 2 && cleaned.length < 15) {
    // Check if it's just a greeting/filler
    if (/^(hey|hi|hello|yo|ok|okay|yeah|yep|nah|no|yes|sure|right|huh|hmm|oh|ah|uh|um)\b/i.test(cleaned)) {
      // Single filler word by itself is likely hallucination on silence
      if (cleaned.split(/\s+/).length === 1) return true;
    }
  }
  return false;
}

/**
 * POST /api/transcribe
 *
 * Accepts audio as FormData with fields:
 *   - file: audio blob (wav preferred, webm accepted by self-hosted)
 *   - engine: "groq" | "self-hosted"
 *   - language: ISO code or "auto"
 *   - groqApiKey: Groq API key (for groq engine)
 *   - selfHostedUrl: URL of self-hosted whisper server
 *   - dictionary: comma-separated custom words
 *   - sessionContext: previous session text (used as Whisper prompt for
 *     better punctuation, pause detection, and style continuity)
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
    const dictionary = formData.get("dictionary") as string;
    const sessionContext = formData.get("sessionContext") as string;

    if (!file) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    const startTime = Date.now();

    // Build the Whisper prompt from session context + dictionary.
    //
    // Whisper's `prompt` parameter is the KEY to good punctuation and
    // pause detection across segments. It conditions the model on the
    // style and content of what came before, so it knows:
    //   - How to punctuate (periods, commas, question marks)
    //   - What capitalization style to use
    //   - That this is a continuation (avoids hallucinating repeated text)
    //   - Custom vocabulary from the dictionary
    //
    // We use the tail end of the session context (last ~400 tokens / ~1600 chars)
    // because Whisper's prompt window is limited.
    const whisperPrompt = buildWhisperPrompt(sessionContext, dictionary);

    if (engine === "groq") {
      return await transcribeWithGroq(file, language, groqApiKey, whisperPrompt, startTime);
    } else {
      return await transcribeWithSelfHosted(file, language, selfHostedUrl, whisperPrompt, startTime);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Transcription failed";
    console.error("Transcription error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── Whisper Prompt Builder ──────────────────────────────────────────

/**
 * Builds the `prompt` parameter for Whisper.
 *
 * IMPORTANT: Whisper's prompt is NOT an instruction — it's a "previous transcript"
 * that Whisper uses to condition its style. Whisper treats the prompt as if it's
 * text that was spoken just before this audio clip. This means:
 *
 * - It will match the punctuation and capitalization style of the prompt
 * - It WON'T repeat the prompt text (built-in dedup)
 * - It can hallucinate words FROM the prompt if the audio is ambiguous
 *
 * Because of that last point, we must be VERY careful:
 * - Only pass actual previously-transcribed text (session context)
 * - Do NOT pass dictionary words directly — they cause hallucinations
 *   when Whisper tries to "hear" them in silence or ambiguous audio
 * - Keep the prompt SHORT — long prompts increase hallucination risk
 *
 * Dictionary words are better handled by post-processing (the LLM can
 * correct spellings) rather than by Whisper's prompt.
 */
function buildWhisperPrompt(
  sessionContext: string | null,
  _dictionary: string | null // intentionally unused — see comment above
): string {
  // Only use session context, NOT dictionary words
  if (!sessionContext || !sessionContext.trim()) {
    return "";
  }

  const trimmed = sessionContext.trim();

  // Take the last ~800 chars (approx 200 tokens).
  // Shorter is safer — long prompts increase hallucination risk.
  // We only need enough for Whisper to match punctuation style.
  const maxLen = 800;
  const tail =
    trimmed.length > maxLen
      ? trimmed.slice(trimmed.length - maxLen)
      : trimmed;

  return tail;
}

// ─── Groq Whisper API ────────────────────────────────────────────────

async function transcribeWithGroq(
  file: File,
  language: string,
  apiKey: string,
  whisperPrompt: string,
  startTime: number
) {
  if (!apiKey) {
    return NextResponse.json(
      { error: "Groq API key is required. Add it in Settings." },
      { status: 400 }
    );
  }

  const groqForm = new FormData();
  groqForm.append("file", file, "audio.wav");
  groqForm.append("model", "whisper-large-v3");
  groqForm.append("response_format", "verbose_json");

  if (language && language !== "auto") {
    groqForm.append("language", language);
  }

  // Pass the session context + dictionary as Whisper's prompt.
  // This is the critical piece for punctuation and pause detection.
  if (whisperPrompt) {
    groqForm.append("prompt", whisperPrompt);
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
  const text = (result.text || "").trim();

  // Filter out Whisper hallucinations on silence
  if (isHallucination(text)) {
    return NextResponse.json({
      text: "",
      language: result.language || language || "auto",
      duration,
      filtered: true,
    });
  }

  return NextResponse.json({
    text,
    language: result.language || language || "auto",
    duration,
  });
}

// ─── Self-Hosted Whisper Server ──────────────────────────────────────

async function transcribeWithSelfHosted(
  file: File,
  language: string,
  serverUrl: string,
  whisperPrompt: string,
  startTime: number
) {
  const url = process.env.WHISPER_SERVER_INTERNAL_URL || serverUrl;

  if (!url) {
    return NextResponse.json(
      { error: "Self-hosted server URL is required. Add it in Settings." },
      { status: 400 }
    );
  }

  const form = new FormData();
  form.append("file", file, "audio.wav");
  if (language && language !== "auto") {
    form.append("language", language);
  }
  if (whisperPrompt) {
    form.append("prompt", whisperPrompt);
  }

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
  const text = (result.text || "").trim();

  if (isHallucination(text)) {
    return NextResponse.json({
      text: "",
      language: result.language || language || "auto",
      duration,
      filtered: true,
    });
  }

  return NextResponse.json({
    text,
    language: result.language || language || "auto",
    duration,
  });
}
