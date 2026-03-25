import type { Extension, ExtensionResult, ExtensionContext } from "./types";

/**
 * Extract the actual search query from a spoken command.
 * E.g., "search for latest AI news" → "latest AI news"
 */
function extractQuery(command: string): string {
  const lower = command.toLowerCase();
  const prefixes = [
    "search for",
    "search",
    "look up",
    "find",
    "what is",
    "what are",
    "who is",
    "who are",
    "how to",
    "how do",
    "how does",
    "google",
    "web search for",
    "web search",
  ];

  for (const prefix of prefixes) {
    if (lower.startsWith(prefix)) {
      const rest = command.slice(prefix.length).trim();
      return rest || command;
    }
  }

  return command;
}

export const searchExtension: Extension = {
  name: "search",
  description: "Search the web using Tavily",
  keywords: [
    "search for",
    "search",
    "look up",
    "find",
    "what is",
    "what are",
    "who is",
    "who are",
    "how to",
    "how do",
    "how does",
    "google",
    "web search",
  ],

  async execute(
    command: string,
    context: ExtensionContext
  ): Promise<ExtensionResult> {
    const query = extractQuery(command);

    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        tavilyApiKey: context.settings.tavilyApiKey || "",
        selfHostedUrl: context.settings.selfHostedUrl || "",
        sttEngine: context.settings.sttEngine,
      }),
    });

    if (!res.ok) {
      const err = await res
        .json()
        .catch(() => ({ error: "Search failed" }));
      throw new Error(err.error || "Search failed");
    }

    const data = await res.json();
    return {
      type: "search",
      searchResults: {
        query: data.query,
        answer: data.answer || null,
        results: data.results || [],
        responseTime: data.response_time || 0,
      },
    };
  },
};
