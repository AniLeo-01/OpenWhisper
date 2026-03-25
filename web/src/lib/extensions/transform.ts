import type { Extension, ExtensionResult, ExtensionContext } from "./types";

export const transformExtension: Extension = {
  name: "transform",
  description: "Transform selected text using a voice command",
  keywords: [
    "transform",
    "make it",
    "make this",
    "rewrite",
    "change",
    "convert",
    "translate",
    "fix",
    "improve",
    "summarize",
    "expand",
    "shorten",
  ],

  async execute(
    command: string,
    context: ExtensionContext
  ): Promise<ExtensionResult> {
    if (!context.selectedText) {
      return {
        type: "text",
        text: "No text selected. Select text first, then use a transform command.",
      };
    }

    const res = await fetch("/api/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectedText: context.selectedText,
        command,
        provider: context.settings.aiProvider,
        groqApiKey: context.settings.groqApiKey,
        openaiApiKey: context.settings.openaiApiKey,
        ollamaUrl: context.settings.ollamaUrl,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Transform failed" }));
      throw new Error(err.error || "Transform failed");
    }

    const { text } = await res.json();
    return { type: "text", text };
  },
};
