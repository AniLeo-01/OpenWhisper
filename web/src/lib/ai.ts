/**
 * Shared AI provider call utilities.
 *
 * Centralizes LLM API calls so they aren't duplicated across API routes.
 */

export async function callAI(
  prompt: string,
  provider: string,
  options: {
    groqApiKey?: string;
    openaiApiKey?: string;
    ollamaUrl?: string;
  }
): Promise<string> {
  switch (provider) {
    case "groq":
      return callGroq(prompt, options.groqApiKey || "");
    case "openai":
      return callOpenAI(prompt, options.openaiApiKey || "");
    case "ollama":
      return callOllama(prompt, options.ollamaUrl || "");
    default:
      return "";
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
