import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/process
 *
 * AI post-processing: cleans up raw transcription.
 * Removes filler words, fixes grammar, handles corrections,
 * adjusts tone based on context.
 *
 * Session-aware: accepts `previousContext` so the LLM understands
 * this is a continuation of an ongoing dictation, not a fresh start.
 *
 * Body: {
 *   text: string,                  // The NEW segment to clean
 *   previousContext?: string,      // Already-cleaned text from earlier in this session
 *   provider: "groq" | "openai" | "ollama" | "none",
 *   tone: "auto" | "casual" | "professional" | "technical",
 *   groqApiKey?: string,
 *   openaiApiKey?: string,
 *   ollamaUrl?: string,
 *   dictionary?: string[],
 * }
 *
 * Returns: { text: string }  // Only the cleaned NEW segment (not the full session)
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

    // Skip post-processing if provider is "none"
    if (provider === "none") {
      return NextResponse.json({ text });
    }

    const prompt = buildPrompt(text, tone, dictionary, previousContext);

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

function buildPrompt(
  text: string,
  tone: string,
  dictionary: string[],
  previousContext: string
): string {
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
      ? `\nThe user has a personal dictionary. If any of these words appear in the dictation, preserve their exact spelling: ${dictionary.join(", ")}. If these words do NOT appear in the dictation, ignore them completely — do NOT mention them or add them.`
      : "";

  // If there's previous context, tell the LLM this is a continuation
  const contextBlock = previousContext.trim()
    ? `
Previously dictated text (for context only — do NOT include this in your output):
"""
${previousContext.trim()}
"""
Use this context only to understand tone, resolve pronouns, and ensure continuity.`
    : "";

  return `You are a text cleanup tool. Your ONLY job is to output the cleaned version of the dictated text below. You must NEVER output explanations, reasoning, commentary, notes, or meta-text. You must NEVER discuss what you changed or why. Your entire response must be ONLY the cleaned text and nothing else.

Rules:
1. Remove filler words: um, uh, like, you know, so, basically, I mean, right, actually
2. Fix grammar, punctuation, and capitalization
3. Handle self-corrections: "no wait", "I mean", "actually" → keep only the final intent
4. Do NOT add any words, sentences, or information that the speaker did not say
5. Do NOT remove meaningful content — only remove filler and fix grammar
6. If the transcription contains garbled/nonsense fragments at the very end (artifacts from speech recognition), silently remove them
7. ${toneInstructions[tone] || toneInstructions.auto}${dictionaryNote}
${contextBlock}
Dictated text to clean:
"""
${text}
"""

Cleaned text:`;
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
