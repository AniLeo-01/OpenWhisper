"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useHotkey } from "@/hooks/useHotkey";
import { useCommandMode } from "@/hooks/useCommandMode";
import { useAppStore } from "@/lib/store";
import { runDictationPipeline } from "@/lib/transcribe";
import { FlowBar, FlowBarState } from "@/components/FlowBar";
import { TextEditor } from "@/components/TextEditor";
import { HistoryPanel } from "@/components/HistoryPanel";
import { OnboardingModal } from "@/components/OnboardingModal";
import { History, Settings, Mic, FilePlus } from "lucide-react";
import Link from "next/link";

export default function Home() {
  const { state: recorderState, startRecording, stopRecording, cancelRecording } =
    useAudioRecorder();

  const [flowState, setFlowState] = useState<FlowBarState>("idle");
  const [isInserting, setIsInserting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Track which mode triggered recording
  const activeModeRef = useRef<"dictate" | "hands-free" | null>(null);

  const settings = useAppStore((s) => s.settings);
  const sessionCleanedText = useAppStore((s) => s.sessionCleanedText);
  const sessionRawText = useAppStore((s) => s.sessionRawText);
  const latestCleanedSegment = useAppStore((s) => s.latestCleanedSegment);
  const sessionSegments = useAppStore((s) => s.sessionSegments);
  const appendSegment = useAppStore((s) => s.appendSegment);
  const getSessionContext = useAppStore((s) => s.getSessionContext);
  const newSession = useAppStore((s) => s.newSession);
  const loadIntoSession = useAppStore((s) => s.loadIntoSession);
  const addToHistory = useAppStore((s) => s.addToHistory);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const commandResult = useAppStore((s) => s.commandResult);

  // Command mode (independent toggle)
  const commandMode = useCommandMode({
    flowState,
    setFlowState,
    setError,
    startRecording,
    stopRecording,
  });

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

  // ─── Generic Start Recording ──────────────────────────────────────

  const handleStart = useCallback(
    async (mode: "dictate" | "hands-free") => {
      if (flowState === "processing" || flowState === "recording" || flowState === "hands-free" || flowState === "command") return;
      setError(null);
      activeModeRef.current = mode;
      try {
        await startRecording();
        const stateMap: Record<string, FlowBarState> = {
          dictate: "recording",
          "hands-free": "hands-free",
        };
        setFlowState(stateMap[mode]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to access microphone");
        setFlowState("idle");
        activeModeRef.current = null;
      }
    },
    [flowState, startRecording]
  );

  // ─── Generic Stop Recording & Process ─────────────────────────────

  const handleStop = useCallback(async () => {
    const mode = activeModeRef.current;
    activeModeRef.current = null;

    if (!mode) return;

    try {
      const audioBlob = await stopRecording();
      if (audioBlob.size === 0) {
        setFlowState("idle");
        return;
      }

      setFlowState("processing");

      // Normal dictation or hands-free: APPEND to session
      const previousContext = getSessionContext();
      setIsInserting(true);
      const result = await runDictationPipeline(audioBlob, settings, previousContext);

      // Only append if there's actual content
      if (result.cleanedText.trim() || result.rawText.trim()) {
        appendSegment({
          id: result.id,
          rawText: result.rawText,
          cleanedText: result.cleanedText,
          timestamp: result.timestamp,
        });

        addToHistory(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed");
    } finally {
      setFlowState("idle");
      setTimeout(() => setIsInserting(false), 1500);
    }
  }, [
    stopRecording,
    settings,
    getSessionContext,
    appendSegment,
    addToHistory,
  ]);

  // ─── Hotkey: Hold to dictate (Ctrl by default) ────────────────────

  const isNotRecording = flowState === "idle" && !commandMode.isActive;

  useHotkey({
    key: settings.hotkeyDictate || "Control",
    onStart: () => handleStart("dictate"),
    onStop: handleStop,
    enabled: isNotRecording || flowState === "recording",
    mode: "hold",
  });

  // ─── Hotkey: Toggle hands-free (Alt by default) ───────────────────

  const handsFreeHotkey = useHotkey({
    key: settings.hotkeyHandsFree || "Alt",
    onStart: () => handleStart("hands-free"),
    onStop: handleStop,
    enabled: isNotRecording || flowState === "hands-free",
    mode: "toggle",
  });

  // ─── Keyboard: Escape to cancel, N for new session ────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: cancel recording or exit command mode
      if (e.key === "Escape") {
        if (commandMode.isActive) {
          commandMode.forceStop();
          cancelRecording();
          setFlowState("idle");
          return;
        }
        if (flowState !== "idle" && flowState !== "processing") {
          cancelRecording();
          activeModeRef.current = null;
          handsFreeHotkey.forceStop();
          setFlowState("idle");
        }
      }

      // New session hotkey (Ctrl+N / Cmd+N)
      if (
        e.key.toLowerCase() === settings.hotkeyNewSession.toLowerCase() &&
        (e.ctrlKey || e.metaKey) &&
        flowState === "idle"
      ) {
        e.preventDefault();
        handleNewSession();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [flowState, cancelRecording, handsFreeHotkey, settings.hotkeyNewSession, commandMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── History selection ────────────────────────────────────────────

  const handleHistorySelect = (text: string) => {
    loadIntoSession(text);
    setHistoryOpen(false);
  };

  // ─── New Session ──────────────────────────────────────────────────

  const handleNewSession = () => {
    if (sessionCleanedText.trim()) {
      addToHistory({
        id: crypto.randomUUID(),
        rawText: sessionRawText,
        cleanedText: sessionCleanedText,
        duration: 0,
        language: settings.language,
        timestamp: Date.now(),
        engine: settings.sttEngine,
      });
    }
    newSession();
  };

  const hasApiKey =
    settings.sttEngine === "groq" ? settings.groqApiKey.length > 0 : true;

  const hasSessionContent = sessionSegments.length > 0;

  // Helper to display a hotkey name nicely
  const fmtKey = (k: string) => {
    const map: Record<string, string> = {
      Control: "Ctrl",
      Alt: "Alt",
      Shift: "Shift",
      Meta: "Cmd",
      " ": "Space",
    };
    return map[k] || k;
  };

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
          {hasSessionContent && (
            <span className="text-xs text-gray-600 ml-1">
              {sessionSegments.length} segment{sessionSegments.length !== 1 ? "s" : ""}
            </span>
          )}
          {commandMode.isActive && (
            <span className="text-xs text-purple-400 bg-purple-500/10 border border-purple-500/20 rounded-full px-2.5 py-0.5 ml-2">
              Command Mode
            </span>
          )}
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
          {hasSessionContent && (
            <button
              onClick={handleNewSession}
              className="p-2.5 text-gray-500 hover:text-cyan-400 rounded-lg hover:bg-cyan-500/10 transition-colors"
              title={`New session (${fmtKey("Control")}+${settings.hotkeyNewSession.toUpperCase()})`}
            >
              <FilePlus className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setHistoryOpen(true)}
            className="p-2.5 text-gray-500 hover:text-white rounded-lg hover:bg-gray-800/50 transition-colors"
            title="History"
          >
            <History className="w-4 h-4" />
          </button>
          <Link
            href="/settings"
            className="p-2.5 text-gray-500 hover:text-white rounded-lg hover:bg-gray-800/50 transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Main content: text editor area */}
      <div className="flex-1 flex flex-col px-6 py-6 pb-24 overflow-y-auto">
        <TextEditor
          text={sessionCleanedText}
          rawText={sessionRawText}
          latestSegment={latestCleanedSegment}
          isInserting={isInserting}
          commandResult={commandResult}
          placeholder={
            hasApiKey
              ? `Hold ${fmtKey(settings.hotkeyDictate)} to dictate. Your polished text will appear here.\n\nPress ${fmtKey(settings.hotkeyHandsFree)} to toggle hands-free mode.\nPress ${fmtKey(settings.hotkeyCommand)} for Command Mode (search, transform, etc.).\n${fmtKey("Control")}+${settings.hotkeyNewSession.toUpperCase()} to start a new session.`
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

      {/* Engine status + hotkey legend (bottom-left) */}
      <div className="fixed bottom-7 left-6 flex items-center gap-3 text-xs text-gray-700">
        <span>{settings.sttEngine === "groq" ? "Groq Whisper" : "Self-hosted"}</span>
        <span className="text-gray-800">|</span>
        <span>
          <kbd className="text-gray-600">{fmtKey(settings.hotkeyDictate)}</kbd> dictate
        </span>
        <span>
          <kbd className="text-gray-600">{fmtKey(settings.hotkeyHandsFree)}</kbd> hands-free
        </span>
        <span>
          <kbd className="text-gray-600">{fmtKey(settings.hotkeyCommand)}</kbd> command
        </span>
      </div>

      {/* The Flow Bar */}
      <FlowBar
        state={flowState}
        audioLevel={recorderState.audioLevel}
        duration={recorderState.duration}
        onClickStart={() => handleStart("dictate")}
        onClickStop={() => {
          if (commandMode.isActive) {
            commandMode.deactivate();
          } else {
            handleStop();
          }
        }}
        commandModeActive={commandMode.isActive}
        onCommandToggle={() => {
          if (commandMode.isActive) {
            commandMode.deactivate();
          } else {
            commandMode.activate();
          }
        }}
        dictateKey={fmtKey(settings.hotkeyDictate)}
        handsFreeKey={fmtKey(settings.hotkeyHandsFree)}
        commandKey={fmtKey(settings.hotkeyCommand)}
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
