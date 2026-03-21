"use client";

import { useAppStore, TranscriptionEntry } from "@/lib/store";
import { Copy, Check, Trash2, Clock, X } from "lucide-react";
import { useState } from "react";

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (text: string) => void;
}

/**
 * Slide-in history panel from the right side.
 * Shows past transcriptions. Click one to load it into the editor.
 */
export function HistoryPanel({ isOpen, onClose, onSelect }: HistoryPanelProps) {
  const history = useAppStore((s) => s.history);
  const clearHistory = useAppStore((s) => s.clearHistory);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`
          fixed right-0 top-0 h-full w-96 max-w-[85vw] bg-gray-950 border-l border-gray-800 z-50
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <div>
              <h2 className="text-lg font-semibold text-white">History</h2>
              <p className="text-xs text-gray-500">
                {history.length} transcription{history.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="p-2 text-gray-500 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
                  title="Clear all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Entries */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {history.length === 0 ? (
              <div className="text-center py-16">
                <Clock className="w-10 h-10 text-gray-800 mx-auto mb-3" />
                <p className="text-gray-600 text-sm">No transcriptions yet</p>
              </div>
            ) : (
              history.map((entry) => (
                <HistoryItem
                  key={entry.id}
                  entry={entry}
                  onSelect={onSelect}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function HistoryItem({
  entry,
  onSelect,
}: {
  entry: TranscriptionEntry;
  onSelect: (text: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(entry.cleanedText || entry.rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const time = new Date(entry.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const date = new Date(entry.timestamp).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });

  const text = entry.cleanedText || entry.rawText;

  return (
    <div
      onClick={() => onSelect(text)}
      className="group bg-gray-900/50 hover:bg-gray-800/50 border border-gray-800/50 hover:border-gray-700 rounded-xl p-4 cursor-pointer transition-colors"
    >
      <p className="text-sm text-gray-200 line-clamp-3 leading-relaxed">
        {text}
      </p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-600">
          {date} {time}
        </span>
        <button
          onClick={handleCopy}
          className="p-1 text-gray-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-green-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
