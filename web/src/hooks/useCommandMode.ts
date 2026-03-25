"use client";

import { useCallback, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { useHotkey } from "@/hooks/useHotkey";
import { runDictationPipeline } from "@/lib/transcribe";
import { matchExtension } from "@/lib/extensions/registry";
import type { ExtensionResult } from "@/lib/extensions/types";
import type { FlowBarState } from "@/components/FlowBar";

interface UseCommandModeOptions {
  flowState: FlowBarState;
  setFlowState: (state: FlowBarState) => void;
  setError: (error: string | null) => void;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob>;
}

/**
 * Encapsulates all command mode logic:
 * - Toggle hotkey activation (independent of text selection)
 * - Records audio, transcribes the spoken command
 * - Routes to the matching extension (search, transform, etc.)
 * - Returns result to display
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
  const addToHistory = useAppStore((s) => s.addToHistory);

  const isRecordingRef = useRef(false);

  const activate = useCallback(async () => {
    if (flowState === "processing") return;

    if (commandModeActive && isRecordingRef.current) {
      // Already recording in command mode — stop and process
      await processCommand();
      return;
    }

    if (commandModeActive && !isRecordingRef.current) {
      // Command mode active but not recording — start recording
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

    // Enter command mode
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
        setFlowState(commandModeActive ? "idle" : "idle");
        setCommandModeActive(false);
        return;
      }

      setFlowState("processing");

      // Transcribe the spoken command (no post-processing — keep raw command)
      const commandResult = await runDictationPipeline(audioBlob, {
        ...settings,
        postProcess: false,
      });
      const commandText = commandResult.rawText;

      if (!commandText.trim()) {
        setFlowState("idle");
        setCommandModeActive(false);
        return;
      }

      // Get selected text (if any, for transform extension)
      const selectedText = window.getSelection()?.toString().trim() || "";

      // Match command to extension
      const extension = matchExtension(commandText, !!selectedText);

      let result: ExtensionResult;

      if (extension) {
        result = await extension.execute(commandText, {
          selectedText: selectedText || undefined,
          settings,
        });
      } else {
        // No extension matched and no text selected — treat as general query
        // Default to search if no match
        const searchExt = (await import("@/lib/extensions/search")).searchExtension;
        result = await searchExt.execute(commandText, {
          selectedText: selectedText || undefined,
          settings,
        });
      }

      // Handle result
      setCommandResult(result);

      if (result.type === "text" && result.text) {
        loadIntoSession(result.text);
        addToHistory({
          id: crypto.randomUUID(),
          rawText: `[Command: ${commandText}] ${selectedText || ""}`.trim(),
          cleanedText: result.text,
          duration: 0,
          language: settings.language,
          timestamp: Date.now(),
          engine: settings.sttEngine,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Command failed");
    } finally {
      setFlowState("idle");
      setCommandModeActive(false);
    }
  }, [stopRecording, settings, commandModeActive, setFlowState, setCommandModeActive, setCommandResult, loadIntoSession, addToHistory, setError]);

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
    onStop: () => {
      // Toggle mode — onStop is not used
    },
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
