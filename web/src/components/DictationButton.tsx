"use client";

import { Mic, Square, Loader2 } from "lucide-react";

interface DictationButtonProps {
  isRecording: boolean;
  isProcessing: boolean;
  onMouseDown: () => void;
  onMouseUp: () => void;
}

export function DictationButton({
  isRecording,
  isProcessing,
  onMouseDown,
  onMouseUp,
}: DictationButtonProps) {
  if (isProcessing) {
    return (
      <button
        disabled
        className="w-24 h-24 rounded-full bg-gray-800 border-2 border-gray-600 flex items-center justify-center cursor-wait transition-all"
      >
        <Loader2 className="w-10 h-10 text-gray-400 animate-spin" />
      </button>
    );
  }

  return (
    <button
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onTouchStart={onMouseDown}
      onTouchEnd={onMouseUp}
      className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-200 select-none
        ${
          isRecording
            ? "bg-red-500/20 border-2 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)] scale-110"
            : "bg-cyan-500/10 border-2 border-cyan-500/50 hover:border-cyan-400 hover:bg-cyan-500/20 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)]"
        }
      `}
    >
      {isRecording ? (
        <Square className="w-8 h-8 text-red-400 fill-red-400" />
      ) : (
        <Mic className="w-10 h-10 text-cyan-400" />
      )}
    </button>
  );
}
