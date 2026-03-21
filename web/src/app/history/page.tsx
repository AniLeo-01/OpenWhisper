"use client";

import { useAppStore, TranscriptionEntry } from "@/lib/store";
import { Copy, Check, Trash2, Clock, ArrowLeft } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

export default function HistoryPage() {
  const history = useAppStore((s) => s.history);
  const clearHistory = useAppStore((s) => s.clearHistory);

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2 text-gray-500 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
          <h1 className="text-2xl font-bold text-white">History</h1>
          <p className="text-gray-400 text-sm mt-1">
            {history.length} transcription{history.length !== 1 ? "s" : ""}
          </p>
        </div>
        </div>
        {history.length > 0 && (
          <button
            onClick={clearHistory}
            className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 px-3 py-2 rounded-lg hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear all
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="text-center py-20">
          <Clock className="w-12 h-12 text-gray-700 mx-auto mb-4" />
          <p className="text-gray-500">No transcriptions yet.</p>
          <p className="text-gray-600 text-sm mt-1">
            Start dictating to see your history here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((entry) => (
            <HistoryEntry key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryEntry({ entry }: { entry: TranscriptionEntry }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(entry.cleanedText || entry.rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const time = new Date(entry.timestamp).toLocaleString();

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-2 group">
      <div className="flex items-start justify-between gap-4">
        <p className="text-gray-100 leading-relaxed flex-1">
          {entry.cleanedText || entry.rawText}
        </p>
        <button
          onClick={handleCopy}
          className="text-gray-500 hover:text-white transition-colors p-1.5 rounded-md hover:bg-gray-800 opacity-0 group-hover:opacity-100"
          title="Copy"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-400" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-600">
        <span>{time}</span>
        <span className="capitalize">{entry.engine}</span>
        {entry.rawText !== entry.cleanedText && (
          <span className="text-cyan-600">AI cleaned</span>
        )}
      </div>
    </div>
  );
}
