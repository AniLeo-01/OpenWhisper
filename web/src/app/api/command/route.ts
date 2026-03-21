import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/command
 *
 * Command Mode: transforms selected text using a voice command.
 * Like Wispr Flow's Command Mode — highlight text, speak "make it more concise",
 * and the text gets transformed.
 *
 * Body: {
 *   selectedText: string,
 *   command: string,
 *   provider: "groq" | "openai" | "ollama",
 *   groqApiKey?: string,
 *   openaiApiKey?: string,
 *   ollamaUrl?: string,
 * }
 *
 * Returns: { text: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { selectedText, command, provider = "groq", groqApiKey, openaiApiKey, ollamaUrl } = body;

    if (!selectedText || !command) {
      return NextResponse.json(
        { error: "Both selectedText and command are required" },
        { status: 400 }
      );
    }

    const prompt = `You are a text transformation assistant. The user has selected text and given a voice command to transform it.

Selected text:
"""
${selectedText}
"""

Voice command: "${command}"

Apply the voice command to transform the selected text. Return ONLY the transformed text. No explanations, no quotes, no prefixes.`;

    let result: string;

    switch (provider) {
      case "groq":
        result = await callGroq(prompt, groqApiKey);
        break;
      case "openai":
        result = await callOpenAI(prompt, openaiApiKey);
        break;
      case "ollama":
        result = await callOllama(prompt, ollamaUrl);
        break;
      default:
        result = selectedText;
    }

    return NextResponse.json({ text: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Command failed";
    console.error("Command mode error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function callGroq(prompt: string, apiKey: string): Promise<string> {
  if (!apiKey) throw new Error("Groq API key required");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 4096,
    }),
  });
  if (!res.ok) throw new Error(`Groq error: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0]?.message?.content?.trim() || "";
}

async function callOpenAI(prompt: string, apiKey: string): Promise<string> {
  if (!apiKey) throw new Error("OpenAI API key required");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 4096,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0]?.message?.content?.trim() || "";
}

async function callOllama(prompt: string, url: string): Promise<string> {
  const ollamaUrl = url || "http://localhost:11434";
  const res = await fetch(`${ollamaUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama3.2",
      prompt,
      stream: false,
      options: { temperature: 0.2 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama error: ${await res.text()}`);
  const data = await res.json();
  return data.response?.trim() || "";
}
