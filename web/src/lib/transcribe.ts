import type { Settings, TranscriptionEntry } from "./store";

export type DictationOptions = Settings & {
  postProcess?: boolean;
};

/**
 * Send audio to the backend pipeline and get a complete transcription entry.
 *
 * The backend handles everything: transcribe → filter hallucinations → post-process.
 * The frontend just sends audio + settings.
 */
export async function runDictationPipeline(
  audioBlob: Blob,
  options: DictationOptions,
  previousContext?: string
): Promise<TranscriptionEntry> {
  const formData = new FormData();
  formData.append("file", audioBlob, "audio.webm");
  formData.append("language", options.language || "auto");
  formData.append("provider", options.aiProvider || "groq");
  formData.append("tone", options.tone || "auto");
  formData.append("post_process", options.postProcess !== false ? "true" : "false");

  if (previousContext) {
    formData.append("previous_context", previousContext);
  }
  if (options.personalDictionary?.length) {
    formData.append("dictionary", options.personalDictionary.join(","));
  }
  if (options.groqApiKey) {
    formData.append("groqApiKey", options.groqApiKey);
  }
  if (options.openaiApiKey) {
    formData.append("openaiApiKey", options.openaiApiKey);
  }
  if (options.ollamaUrl) {
    formData.append("ollamaUrl", options.ollamaUrl);
  }
  if (options.selfHostedUrl) {
    formData.append("selfHostedUrl", options.selfHostedUrl);
  }
  formData.append("engine", options.sttEngine);

  const res = await fetch("/api/transcribe", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Transcription failed" }));
    throw new Error(err.error || `Transcription failed (${res.status})`);
  }

  const data = await res.json();

  return {
    id: data.id || crypto.randomUUID(),
    rawText: (data.raw_text ?? data.text ?? "").trim(),
    cleanedText: (data.cleaned_text ?? data.raw_text ?? data.text ?? "").trim(),
    timestamp: Date.now(),
    duration: data.duration_ms || data.duration || 0,
    language: data.language || options.language || "auto",
    engine: options.sttEngine,
  };
}
