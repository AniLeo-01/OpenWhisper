import type { Settings, TranscriptionEntry } from "./store";

export type DictationOptions = Settings & {
  postProcess?: boolean;
};

/**
 * End-to-end dictation pipeline:
 * 1. Transcribe audio via /api/transcribe
 * 2. Post-process via /api/process (if enabled)
 * 3. Return a TranscriptionEntry
 */
export async function runDictationPipeline(
  audioBlob: Blob,
  options: DictationOptions,
  previousContext?: string
): Promise<TranscriptionEntry> {
  // Step 1: Transcribe
  const formData = new FormData();
  formData.append("file", audioBlob, "audio.webm");
  formData.append("engine", options.sttEngine);
  formData.append("language", options.language || "auto");

  if (options.groqApiKey) {
    formData.append("groqApiKey", options.groqApiKey);
  }
  if (options.selfHostedUrl) {
    formData.append("selfHostedUrl", options.selfHostedUrl);
  }
  if (options.personalDictionary?.length) {
    formData.append("dictionary", options.personalDictionary.join(","));
  }
  if (previousContext) {
    formData.append("sessionContext", previousContext);
  }

  const transcribeRes = await fetch("/api/transcribe", {
    method: "POST",
    body: formData,
  });

  if (!transcribeRes.ok) {
    const err = await transcribeRes.json().catch(() => ({ error: "Transcription failed" }));
    throw new Error(err.error || `Transcription failed (${transcribeRes.status})`);
  }

  const transcription = await transcribeRes.json();
  const rawText = (transcription.text || "").trim();

  // Step 2: Post-process (if enabled and there's text)
  let cleanedText = rawText;

  if (options.postProcess !== false && rawText && options.aiProvider !== "none") {
    try {
      const processRes = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: rawText,
          previousContext: previousContext || "",
          provider: options.aiProvider,
          tone: options.tone,
          groqApiKey: options.groqApiKey,
          openaiApiKey: options.openaiApiKey,
          ollamaUrl: options.ollamaUrl,
          dictionary: options.personalDictionary || [],
        }),
      });

      if (processRes.ok) {
        const processed = await processRes.json();
        cleanedText = (processed.text || rawText).trim();
      }
    } catch {
      // Fall back to raw text if post-processing fails
    }
  }

  return {
    id: crypto.randomUUID(),
    rawText,
    cleanedText,
    timestamp: Date.now(),
    duration: transcription.duration || 0,
    language: transcription.language || options.language || "auto",
    engine: options.sttEngine,
  };
}
