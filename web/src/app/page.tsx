"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useHotkey } from "@/hooks/useHotkey";
import { useAppStore } from "@/lib/store";
import { runDictationPipeline } from "@/lib/transcribe";
import { FlowBar, FlowBarState } from "@/components/FlowBar";
import { TextEditor } from "@/components/TextEditor";
import { HistoryPanel } from "@/components/HistoryPanel";
import { OnboardingModal } from "@/components/OnboardingModal";
import { History, Settings, Mic } from "lucide-react";
import Link from "next/link";

export default function Home() {
  const { state: recorderState, startRecording, stopRecording, cancelRecording } =
    useAudioRecorder();

  const [flowState, setFlowState] = useState<FlowBarState>("idle");
  const [isInserting, setIsInserting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [commandSelectedText, setCommandSelectedText] = useState("");

  // Separate ref for hands-free mode
  const handsFreeRef = useRef(false);
  // Track if we're in command mode recording
  const commandModeRef = useRef(false);

  const settings = useAppStore((s) => s.settings);
  const currentRawText = useAppStore((s) => s.currentRawText);
  const currentCleanedText = useAppStore((s) => s.currentCleanedText);
  const setRawText = useAppStore((s) => s.setRawText);
  const setCleanedText = useAppStore((s) => s.setCleanedText);
  const addToHistory = useAppStore((s) => s.addToHistory);
  const updateSettings = useAppStore((s) => s.updateSettings);

  // Check if first run (no API key set)
  useEffect(() => {
    const seen = typeof window !== "undefined" && localStorage.getItem("openwhisper-onboarded");
    if (!seen && !settings.groqApiKey) {
      setShowOnboarding(true);
    }
  }, [settings.groqApiKey]);

  const handleOnboardingComplete = (apiKey: string) => {
    if (apiKey) {
      updateSettings({ groqApiKey: apiKey });
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("openwhisper-onboarded", "true");
    }
    setShowOnboarding(false);
  };

  // ─── Start Recording ─────────────────────────────────────────────

  const handleStartRecording = useCallback(async () => {
    if (flowState === "processing") return;
    setError(null);
    try {
      await startRecording();
      if (commandModeRef.current) {
        setFlowState("command");
      } else if (handsFreeRef.current) {
        setFlowState("hands-free");
      } else {
        setFlowState("recording");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to access microphone");
      setFlowState("idle");
    }
  }, [flowState, startRecording]);

  // ─── Stop Recording & Process ─────────────────────────────────────

  const handleStopRecording = useCallback(async () => {
    try {
      const audioBlob = await stopRecording();
      if (audioBlob.size === 0) {
        setFlowState("idle");
        return;
      }

      const wasCommandMode = commandModeRef.current;
      commandModeRef.current = false;
      handsFreeRef.current = false;

      setFlowState("processing");

      if (wasCommandMode && commandSelectedText) {
        // Command Mode: transcribe the command, then transform selected text
        const commandResult = await runDictationPipeline(audioBlob, {
          ...settings,
          postProcess: false, // raw command text
        });

        const commandText = commandResult.rawText;

        // Now run the command on the selected text
        const res = await fetch("/api/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selectedText: commandSelectedText,
            command: commandText,
            provider: settings.aiProvider,
            groqApiKey: settings.groqApiKey,
            openaiApiKey: settings.openaiApiKey,
            ollamaUrl: settings.ollamaUrl,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Command failed");
        }

        const { text: transformedText } = await res.json();

        // Replace selected text with transformed text
        setRawText(commandSelectedText);
        setCleanedText(transformedText);
        setIsInserting(true);
        addToHistory({
          id: crypto.randomUUID(),
          rawText: `[Command: ${commandText}] ${commandSelectedText}`,
          cleanedText: transformedText,
          duration: 0,
          language: settings.language,
          timestamp: Date.now(),
          engine: settings.sttEngine,
        });
      } else {
        // Normal dictation
        setIsInserting(true);
        const result = await runDictationPipeline(audioBlob, settings);
        setRawText(result.rawText);
        setCleanedText(result.cleanedText);
        addToHistory(result);
      }

      setCommandSelectedText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed");
    } finally {
      setFlowState("idle");
      setTimeout(() => setIsInserting(false), 1500);
    }
  }, [
    stopRecording,
    settings,
    commandSelectedText,
    setRawText,
    setCleanedText,
    addToHistory,
  ]);

  // ─── Hotkey: Hold Ctrl to dictate ─────────────────────────────────

  useHotkey({
    key: settings.hotkey || "Control",
    onStart: handleStartRecording,
    onStop: handleStopRecording,
    enabled: flowState !== "processing",
  });

  // ─── Keyboard: Escape to cancel ───────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && flowState !== "idle" && flowState !== "processing") {
        cancelRecording();
        commandModeRef.current = false;
        handsFreeRef.current = false;
        setFlowState("idle");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [flowState, cancelRecording]);

  // ─── Command Mode trigger ─────────────────────────────────────────

  const handleCommandMode = useCallback(
    (selectedText: string) => {
      setCommandSelectedText(selectedText);
      commandModeRef.current = true;
      handleStartRecording();
    },
    [handleStartRecording]
  );

  // ─── History selection ────────────────────────────────────────────

  const handleHistorySelect = (text: string) => {
    setCleanedText(text);
    setRawText(text);
    setHistoryOpen(false);
  };

  const hasApiKey =
    settings.sttEngine === "groq" ? settings.groqApiKey.length > 0 : true;

  return (
    <div className="flex flex-col h-full">
      {/* Onboarding */}
      {showOnboarding && (
        <OnboardingModal onComplete={handleOnboardingComplete} />
      )}

      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
            <Mic className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-white tracking-tight">
            OpenWhisper
          </span>
        </div>

        <div className="flex items-center gap-1">
          {!hasApiKey && (
            <Link
              href="/settings"
              className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-1.5 hover:bg-yellow-500/20 transition-colors mr-2"
            >
              Add API key
            </Link>
          )}
          <button
            onClick={() => setHistoryOpen(true)}
            className="p-2.5 text-gray-500 hover:text-white rounded-lg hover:bg-gray-800/50 transition-colors"
            title="History"
          >
            <History className="w-4.5 h-4.5" />
          </button>
          <Link
            href="/settings"
            className="p-2.5 text-gray-500 hover:text-white rounded-lg hover:bg-gray-800/50 transition-colors"
            title="Settings"
          >
            <Settings className="w-4.5 h-4.5" />
          </Link>
        </div>
      </header>

      {/* Main content: text editor area */}
      <div className="flex-1 flex flex-col px-6 py-6 pb-24 overflow-y-auto">
        <TextEditor
          text={currentCleanedText}
          rawText={currentRawText}
          isInserting={isInserting}
          onCommandMode={handleCommandMode}
          placeholder={
            hasApiKey
              ? "Hold Ctrl and speak to dictate. Your polished text will appear here.\n\nTry saying something like:\n  \"Hey, let's schedule a meeting for Friday at 3pm to discuss the project roadmap\"\n\nFlow will clean it up automatically — no filler words, proper grammar, clean formatting."
              : "Add your Groq API key in Settings to get started. It's free at console.groq.com"
          }
        />
      </div>

      {/* Error toast */}
      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-3 backdrop-blur-md shadow-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Engine status (bottom-left) */}
      <div className="fixed bottom-7 left-6 flex items-center gap-3 text-xs text-gray-700">
        <span>{settings.sttEngine === "groq" ? "Groq Whisper" : "Self-hosted"}</span>
        <span className="text-gray-800">|</span>
        <span>
          AI: {settings.aiProvider === "none" ? "Off" : settings.aiProvider}
        </span>
      </div>

      {/* The Flow Bar */}
      <FlowBar
        state={flowState}
        audioLevel={recorderState.audioLevel}
        duration={recorderState.duration}
        onClickStart={handleStartRecording}
        onClickStop={handleStopRecording}
      />

      {/* History Panel */}
      <HistoryPanel
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelect={handleHistorySelect}
      />
    </div>
  );
}
