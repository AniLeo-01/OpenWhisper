"use client";

import { useRef, useEffect, useState } from "react";
import { Copy, Check, RotateCcw, Sparkles } from "lucide-react";

interface TextEditorProps {
  /** The full accumulated session text (cleaned) */
  text: string;
  /** The full accumulated session text (raw) */
  rawText: string;
  /** Only the latest segment (for typing animation) */
  latestSegment: string;
  /** Whether text is currently being inserted (animate typing) */
  isInserting: boolean;
  /** Called when user selects text and triggers command mode */
  onCommandMode: (selectedText: string) => void;
  /** Placeholder when empty */
  placeholder?: string;
}

/**
 * The main text area where dictated text accumulates.
 *
 * Session-aware: shows the full accumulated text with the latest
 * segment animated in via a typing effect. Previous segments remain
 * stable above.
 */
export function TextEditor({
  text,
  rawText,
  latestSegment,
  isInserting,
  onCommandMode,
  placeholder = "Start dictating and your text will appear here...",
}: TextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [selectedText, setSelectedText] = useState("");

  // The stable part of the text (everything except the latest segment being typed)
  // We compute this by removing the latest segment from the full text
  const stableText = latestSegment && text.endsWith(latestSegment)
    ? text.slice(0, text.length - latestSegment.length)
    : text;

  // Animated portion: the latest segment that's being typed in
  const [animatedText, setAnimatedText] = useState("");
  const animTargetRef = useRef("");

  useEffect(() => {
    if (!isInserting || !latestSegment) {
      setAnimatedText(latestSegment);
      return;
    }

    // Reset animation when a new segment arrives
    if (latestSegment !== animTargetRef.current) {
      animTargetRef.current = latestSegment;
      setAnimatedText("");

      let index = 0;
      const interval = setInterval(() => {
        index += 2;
        if (index >= latestSegment.length) {
          setAnimatedText(latestSegment);
          clearInterval(interval);
        } else {
          setAnimatedText(latestSegment.slice(0, index));
        }
      }, 15);

      return () => clearInterval(interval);
    }
  }, [latestSegment, isInserting]);

  // Auto-scroll to bottom when new text arrives
  useEffect(() => {
    if (editorRef.current && isInserting) {
      editorRef.current.scrollTop = editorRef.current.scrollHeight;
    }
  }, [animatedText, isInserting]);

  // Track text selection for Command Mode
  const handleSelect = () => {
    const selection = window.getSelection();
    const selected = selection?.toString().trim() || "";
    setSelectedText(selected);
  };

  const handleCopy = async () => {
    const content = showRaw ? rawText : text;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasContent = text.length > 0 || rawText.length > 0;

  // What to actually render in the editor
  const displayStable = showRaw
    ? rawText // In raw mode, show the full raw text, no animation
    : stableText;
  const displayAnimated = showRaw ? "" : animatedText;
  const showCursor = isInserting && !showRaw;

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col flex-1">
      {/* Toolbar */}
      {hasContent && (
        <div className="flex items-center justify-between px-1 py-2">
          <div className="flex items-center gap-2">
            {rawText && rawText !== text && (
              <button
                onClick={() => setShowRaw(!showRaw)}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded-md hover:bg-gray-800/50 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                {showRaw ? "Show cleaned" : "Show raw"}
              </button>
            )}
            {selectedText && (
              <button
                onClick={() => onCommandMode(selectedText)}
                className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 px-2 py-1 rounded-md bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
              >
                <Sparkles className="w-3 h-3" />
                Command Mode
              </button>
            )}
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded-md hover:bg-gray-800/50 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-green-400" />
                <span className="text-green-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                Copy all
              </>
            )}
          </button>
        </div>
      )}

      {/* Editor area */}
      <div
        ref={editorRef}
        onMouseUp={handleSelect}
        className={`
          flex-1 min-h-[300px] rounded-xl px-6 py-5 overflow-y-auto
          text-lg leading-relaxed selection:bg-purple-500/20
          ${hasContent ? "text-gray-100" : "text-gray-600"}
          ${isInserting ? "border border-cyan-500/20 bg-cyan-500/[0.02]" : "border border-gray-800/50 bg-gray-950/30"}
          transition-colors duration-300 focus:outline-none
        `}
      >
        {hasContent ? (
          <p className="whitespace-pre-wrap">
            {/* Stable (previously completed) segments */}
            {displayStable}
            {/* Spacer between stable and new segment */}
            {displayStable && displayAnimated ? " " : ""}
            {/* Latest segment being typed in */}
            {displayAnimated && (
              <span className={isInserting ? "text-cyan-100" : ""}>
                {displayAnimated}
              </span>
            )}
            {/* Typing cursor */}
            {showCursor && (
              <span className="inline-block w-0.5 h-5 bg-cyan-400 ml-0.5 animate-pulse" />
            )}
          </p>
        ) : (
          <p className="select-none whitespace-pre-wrap">{placeholder}</p>
        )}
      </div>
    </div>
  );
}
