"use client";

import { Copy, Check, RotateCcw } from "lucide-react";
import { useState } from "react";

interface TranscriptionCardProps {
  rawText: string;
  cleanedText: string;
  showRaw?: boolean;
}

export function TranscriptionCard({
  rawText,
  cleanedText,
  showRaw = true,
}: TranscriptionCardProps) {
  const [copied, setCopied] = useState(false);
  const [showingRaw, setShowingRaw] = useState(false);

  const displayText = showingRaw ? rawText : cleanedText;
  const hasContent = cleanedText.length > 0 || rawText.length > 0;

  if (!hasContent) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-2xl bg-gray-900/50 border border-gray-700 rounded-xl p-6 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-400">
            {showingRaw ? "Raw transcription" : "Cleaned output"}
          </span>
          {rawText !== cleanedText && showRaw && (
            <button
              onClick={() => setShowingRaw(!showingRaw)}
              className="text-xs text-cyan-500 hover:text-cyan-400 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              {showingRaw ? "Show cleaned" : "Show raw"}
            </button>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-md hover:bg-gray-800"
          title="Copy to clipboard"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-400" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>
      <p className="text-lg text-gray-100 leading-relaxed whitespace-pre-wrap">
        {displayText}
      </p>
    </div>
  );
}
