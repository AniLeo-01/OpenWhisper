import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/process
 *
 * AI post-processing: cleans up raw transcription.
 * Removes filler words, fixes grammar, handles corrections,
 * adjusts tone based on context.
 *
 * Body: {
 *   text: string,
 *   provider: "groq" | "openai" | "ollama" | "none",
 *   tone: "auto" | "casual" | "professional" | "technical",
 *   groqApiKey?: string,
 *   openaiApiKey?: string,
 *   ollamaUrl?: string,
 *   dictionary?: string[],
 * }
 *
 * Returns: { text: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      text,
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

    // Skip post-processing if provider is "none"
    if (provider === "none") {
      return NextResponse.json({ text });
    }

    const prompt = buildPrompt(text, tone, dictionary);

    let cleanedText: string;

    switch (provider) {
      case "groq":
        cleanedText = await processWithGroq(prompt, groqApiKey);
        break;
      case "openai":
        cleanedText = await processWithOpenAI(prompt, openaiApiKey);
        break;
      case "ollama":
        cleanedText = await processWithOllama(prompt, ollamaUrl);
        break;
      default:
        cleanedText = text;
    }

    return NextResponse.json({ text: cleanedText });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Processing failed";
    console.error("Post-processing error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── Prompt Builder ──────────────────────────────────────────────────

function buildPrompt(text: string, tone: string, dictionary: string[]): string {
  const toneInstructions: Record<string, string> = {
    auto: "Match the natural tone of the text.",
    casual:
      "Make it casual and conversational. Use contractions. Keep it short and friendly.",
    professional:
      "Make it professional and polished. Use complete sentences. Formal but not stiff.",
    technical:
      "Keep technical terms exactly as spoken. Use precise language. Preserve code-related terms.",
  };

  const dictionaryNote =
    dictionary.length > 0
      ? `\nIMPORTANT: These are custom terms that must be preserved exactly: ${dictionary.join(", ")}`
      : "";

  return `You are a text cleanup assistant for a voice dictation tool. Clean up the following dictated text.

Rules:
- Remove filler words (um, uh, like, you know, so, basically, I mean, right, actually)
- Fix grammar, punctuation, and capitalization
- Handle self-corrections: if the speaker says "no wait", "I mean", "actually", "let me rephrase", keep only their final intent
- Do NOT add information or change the meaning
- Do NOT add greetings, sign-offs, or any text not present in the dictation
- ${toneInstructions[tone] || toneInstructions.auto}${dictionaryNote}

Return ONLY the cleaned text. No explanations, no quotes, no prefixes.

Dictated text:
${text}`;
}

// ─── Providers ───────────────────────────────────────────────────────

async function processWithGroq(prompt: string, apiKey: string): Promise<string> {
  if (!apiKey) throw new Error("Groq API key required for post-processing");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error: ${err}`);
  }

  const result = await response.json();
  return result.choices[0]?.message?.content?.trim() || "";
}

async function processWithOpenAI(prompt: string, apiKey: string): Promise<string> {
  if (!apiKey) throw new Error("OpenAI API key required for post-processing");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${err}`);
  }

  const result = await response.json();
  return result.choices[0]?.message?.content?.trim() || "";
}

async function processWithOllama(prompt: string, url: string): Promise<string> {
  const ollamaUrl = url || "http://localhost:11434";

  const response = await fetch(`${ollamaUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama3.2",
      prompt,
      stream: false,
      options: { temperature: 0.1 },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Ollama error: ${err}`);
  }

  const result = await response.json();
  return result.response?.trim() || "";
}
