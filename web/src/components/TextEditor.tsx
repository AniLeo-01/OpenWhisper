"use client";

import { useRef, useEffect, useState } from "react";
import { Copy, Check, RotateCcw, Sparkles } from "lucide-react";

interface TextEditorProps {
  /** The cleaned/final text to show */
  text: string;
  /** Raw transcription (before AI cleanup) */
  rawText: string;
  /** Whether text is currently being inserted (animate typing) */
  isInserting: boolean;
  /** Called when user selects text and triggers command mode */
  onCommandMode: (selectedText: string) => void;
  /** Placeholder when empty */
  placeholder?: string;
}

/**
 * The main text area where dictated text appears.
 * Simulates the experience of text being typed into any app.
 * Supports Command Mode: select text → transform with voice.
 */
export function TextEditor({
  text,
  rawText,
  isInserting,
  onCommandMode,
  placeholder = "Start dictating and your text will appear here...",
}: TextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [displayText, setDisplayText] = useState(text);

  // Typing animation when new text arrives
  useEffect(() => {
    if (!isInserting || !text) {
      setDisplayText(text);
      return;
    }

    let index = displayText.length;
    const target = text;

    if (index >= target.length) {
      setDisplayText(target);
      return;
    }

    const interval = setInterval(() => {
      index += 2; // type 2 chars at a time for speed
      if (index >= target.length) {
        setDisplayText(target);
        clearInterval(interval);
      } else {
        setDisplayText(target.slice(0, index));
      }
    }, 15);

    return () => clearInterval(interval);
  }, [text, isInserting]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const shownText = showRaw ? rawText : displayText;

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
                Copy
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
          flex-1 min-h-[300px] rounded-xl px-6 py-5
          text-lg leading-relaxed selection:bg-purple-500/20
          ${hasContent ? "text-gray-100" : "text-gray-600"}
          ${isInserting ? "border border-cyan-500/20 bg-cyan-500/[0.02]" : "border border-gray-800/50 bg-gray-950/30"}
          transition-colors duration-300 focus:outline-none
        `}
      >
        {hasContent ? (
          <p className="whitespace-pre-wrap">
            {shownText}
            {isInserting && (
              <span className="inline-block w-0.5 h-5 bg-cyan-400 ml-0.5 animate-pulse" />
            )}
          </p>
        ) : (
          <p className="select-none">{placeholder}</p>
        )}
      </div>
    </div>
  );
}
