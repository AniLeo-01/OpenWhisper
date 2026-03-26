"use client";

import { useCallback, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { useHotkey } from "@/hooks/useHotkey";
import { runDictationPipeline } from "@/lib/transcribe";
import type { FlowBarState } from "@/components/FlowBar";

interface UseCommandModeOptions {
  flowState: FlowBarState;
  setFlowState: (state: FlowBarState) => void;
  setError: (error: string | null) => void;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob>;
}

/**
 * Command mode hook — handles only I/O:
 * 1. Toggle activation via hotkey
 * 2. Record audio
 * 3. Get selected text from DOM
 * 4. Send to backend (/api/command/execute)
 * 5. Return result for display
 *
 * All business logic (extension detection, routing, query extraction)
 * lives in the backend.
 */
export function useCommandMode({
  flowState,
  setFlowState,
  setError,
  startRecording,
  stopRecording,
}: UseCommandModeOptions) {
  const settings = useAppStore((s) => s.settings);
  const commandModeActive = useAppStore((s) => s.commandModeActive);
  const setCommandModeActive = useAppStore((s) => s.setCommandModeActive);
  const setCommandResult = useAppStore((s) => s.setCommandResult);
  const loadIntoSession = useAppStore((s) => s.loadIntoSession);
  const replaceInSession = useAppStore((s) => s.replaceInSession);

  const isRecordingRef = useRef(false);

  const activate = useCallback(async () => {
    if (flowState === "processing") return;

    if (commandModeActive && isRecordingRef.current) {
      await processCommand();
      return;
    }

    if (commandModeActive && !isRecordingRef.current) {
      try {
        setError(null);
        await startRecording();
        isRecordingRef.current = true;
        setFlowState("command");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to access microphone");
      }
      return;
    }

    // Enter command mode and start recording
    setCommandModeActive(true);
    setCommandResult(null);
    setError(null);

    try {
      await startRecording();
      isRecordingRef.current = true;
      setFlowState("command");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to access microphone");
      setCommandModeActive(false);
    }
  }, [flowState, commandModeActive, startRecording, setFlowState, setError, setCommandModeActive, setCommandResult]); // eslint-disable-line react-hooks/exhaustive-deps

  const processCommand = useCallback(async () => {
    try {
      const audioBlob = await stopRecording();
      isRecordingRef.current = false;

      if (audioBlob.size === 0) {
        setFlowState("idle");
        setCommandModeActive(false);
        return;
      }

      setFlowState("processing");

      // Step 1: Transcribe the spoken command (no post-processing)
      const commandResult = await runDictationPipeline(audioBlob, {
        ...settings,
        postProcess: false,
      });
      const commandText = commandResult.rawText || commandResult.cleanedText;

      if (!commandText.trim()) {
        setFlowState("idle");
        setCommandModeActive(false);
        return;
      }

      // Step 2: Get selected text from DOM (I/O only)
      const selectedText = window.getSelection()?.toString().trim() || "";

      // Step 3: Send to backend — backend handles all routing/logic
      const res = await fetch("/api/command/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: commandText,
          selectedText,
          provider: settings.aiProvider,
          groqApiKey: settings.groqApiKey,
          openaiApiKey: settings.openaiApiKey,
          ollamaUrl: settings.ollamaUrl,
          tavilyApiKey: settings.tavilyApiKey,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Command failed" }));
        throw new Error(err.error || "Command failed");
      }

      const data = await res.json();

      // Step 4: Display result
      if (data.type === "text" && data.text) {
        setCommandResult({ type: "text", text: data.text });
        if (selectedText) {
          replaceInSession(selectedText, data.text);
        } else {
          loadIntoSession(data.text);
        }
      } else if (data.type === "search") {
        setCommandResult({
          type: "search",
          searchResults: {
            query: data.query || "",
            answer: data.answer || null,
            results: data.results || [],
            responseTime: data.response_time || 0,
          },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Command failed");
    } finally {
      setFlowState("idle");
      setCommandModeActive(false);
    }
  }, [stopRecording, settings, setFlowState, setCommandModeActive, setCommandResult, loadIntoSession, replaceInSession, setError]);

  const deactivate = useCallback(() => {
    if (isRecordingRef.current) {
      processCommand();
    } else {
      setCommandModeActive(false);
      setFlowState("idle");
    }
  }, [processCommand, setCommandModeActive, setFlowState]);

  // Toggle hotkey for command mode
  const commandHotkey = useHotkey({
    key: settings.hotkeyCommand || "Shift",
    onStart: () => {
      if (commandModeActive) {
        deactivate();
      } else {
        activate();
      }
    },
    onStop: () => {},
    enabled: flowState === "idle" || flowState === "command",
    mode: "toggle",
  });

  return {
    isActive: commandModeActive,
    activate,
    deactivate,
    forceStop: () => {
      isRecordingRef.current = false;
      setCommandModeActive(false);
      commandHotkey.forceStop();
    },
  };
}
