import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai";

/**
 * POST /api/command
 *
 * Command Mode: transforms selected text using a voice command.
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
    const {
      selectedText,
      command,
      provider = "groq",
      groqApiKey,
      openaiApiKey,
      ollamaUrl,
    } = body;

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

    const result = await callAI(prompt, provider, {
      groqApiKey,
      openaiApiKey,
      ollamaUrl,
    });

    return NextResponse.json({ text: result || selectedText });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Command failed";
    console.error("Command mode error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
