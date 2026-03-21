"use client";

import { useEffect, useRef } from "react";
import { Mic, Square, Loader2, Sparkles, Settings } from "lucide-react";
import Link from "next/link";

export type FlowBarState = "idle" | "recording" | "processing" | "hands-free" | "command";

interface FlowBarProps {
  state: FlowBarState;
  audioLevel: number;
  duration: number;
  onClickStart: () => void;
  onClickStop: () => void;
}

/**
 * The Flow Bar — a floating pill at the bottom of the screen.
 * Mirrors Wispr Flow's signature UI element.
 *
 * States:
 *  - idle: subtle dark pill with mic icon, "Hold Ctrl to dictate"
 *  - recording: expanded pill with animated waveform + red glow
 *  - processing: pill with spinner, "Transcribing..."
 *  - hands-free: similar to recording but with "Listening..." label
 *  - command: purple tinted, "Speak a command..."
 */
export function FlowBar({
  state,
  audioLevel,
  duration,
  onClickStart,
  onClickStop,
}: FlowBarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barsRef = useRef<number[]>(Array(24).fill(0));
  const animRef = useRef<number>(0);

  // Waveform animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isActive = state === "recording" || state === "hands-free" || state === "command";

    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const bars = barsRef.current;
      const barWidth = width / bars.length;
      const gap = 2;

      for (let i = 0; i < bars.length; i++) {
        const target = isActive ? audioLevel * (0.3 + Math.random() * 0.7) : 0.05;
        bars[i] = bars[i] * 0.82 + target * 0.18;

        const barHeight = Math.max(bars[i] * height * 0.9, 2);
        const x = i * barWidth + gap / 2;
        const y = (height - barHeight) / 2;

        const color =
          state === "command"
            ? `rgba(168, 85, 247, ${0.4 + bars[i] * 0.6})`
            : `rgba(255, 255, 255, ${0.3 + bars[i] * 0.7})`;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth - gap, barHeight, 1.5);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [state, audioLevel]);

  const isActive = state === "recording" || state === "hands-free" || state === "command";

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div
        className={`
          flex items-center gap-3 px-4 py-2.5 rounded-full transition-all duration-300 select-none
          ${state === "idle" ? "bg-gray-900/90 border border-gray-700/50 shadow-lg backdrop-blur-md hover:border-gray-600 cursor-pointer" : ""}
          ${state === "recording" ? "bg-gray-900/95 border border-red-500/40 shadow-[0_0_25px_rgba(239,68,68,0.15)] backdrop-blur-md" : ""}
          ${state === "hands-free" ? "bg-gray-900/95 border border-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.15)] backdrop-blur-md" : ""}
          ${state === "processing" ? "bg-gray-900/90 border border-cyan-500/30 shadow-lg backdrop-blur-md" : ""}
          ${state === "command" ? "bg-gray-900/95 border border-purple-500/40 shadow-[0_0_25px_rgba(168,85,247,0.15)] backdrop-blur-md" : ""}
        `}
        onClick={state === "idle" ? onClickStart : undefined}
      >
        {/* Left icon */}
        <div className="flex items-center justify-center w-8 h-8">
          {state === "idle" && (
            <Mic className="w-4 h-4 text-gray-400" />
          )}
          {state === "recording" && (
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          )}
          {state === "hands-free" && (
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
          )}
          {state === "processing" && (
            <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
          )}
          {state === "command" && (
            <Sparkles className="w-4 h-4 text-purple-400" />
          )}
        </div>

        {/* Center: waveform or status text */}
        {isActive ? (
          <div className="flex items-center gap-3">
            <canvas
              ref={canvasRef}
              width={120}
              height={28}
              className="w-[120px] h-7"
            />
            <span className="text-xs text-gray-400 font-mono tabular-nums min-w-[32px]">
              {formatDuration(duration)}
            </span>
          </div>
        ) : state === "processing" ? (
          <span className="text-sm text-gray-300">Transcribing...</span>
        ) : (
          <span className="text-sm text-gray-500">
            Hold{" "}
            <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400 text-xs font-mono">
              Ctrl
            </kbd>{" "}
            to dictate
          </span>
        )}

        {/* Right: stop button or settings */}
        {isActive ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClickStop();
            }}
            className="flex items-center justify-center w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <Square className="w-3 h-3 text-white fill-white" />
          </button>
        ) : state === "idle" ? (
          <Link
            href="/settings"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-white/10 transition-colors"
          >
            <Settings className="w-3.5 h-3.5 text-gray-600" />
          </Link>
        ) : null}
      </div>

      {/* Subtle label below bar */}
      {state === "recording" && (
        <p className="text-center text-xs text-gray-600 mt-2 animate-pulse">
          Release to transcribe
        </p>
      )}
      {state === "hands-free" && (
        <p className="text-center text-xs text-emerald-600/60 mt-2">
          Listening... press Ctrl to stop
        </p>
      )}
      {state === "command" && (
        <p className="text-center text-xs text-purple-500/60 mt-2">
          Speak a command to transform selected text
        </p>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
