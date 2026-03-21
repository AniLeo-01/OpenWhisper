"use client";

import { useEffect, useRef, useCallback } from "react";

interface UseHotkeyOptions {
  /** Key to listen for (default: "Control") */
  key?: string;
  /** Called when key is pressed */
  onStart: () => void;
  /** Called when key is released */
  onStop: () => void;
  /** Whether the hotkey is enabled */
  enabled?: boolean;
}

/**
 * Push-to-talk hotkey hook.
 * Hold the key to trigger onStart, release to trigger onStop.
 */
export function useHotkey({
  key = "Control",
  onStart,
  onStop,
  enabled = true,
}: UseHotkeyOptions) {
  const isPressedRef = useRef(false);
  const onStartRef = useRef(onStart);
  const onStopRef = useRef(onStop);

  onStartRef.current = onStart;
  onStopRef.current = onStop;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;
      if (e.key === key && !isPressedRef.current && !e.repeat) {
        // Don't trigger in text inputs unless it's a modifier key
        const target = e.target as HTMLElement;
        if (
          !["Control", "Alt", "Meta", "Shift"].includes(key) &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        ) {
          return;
        }
        isPressedRef.current = true;
        onStartRef.current();
      }
    },
    [key, enabled]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === key && isPressedRef.current) {
        isPressedRef.current = false;
        onStopRef.current();
      }
    },
    [key]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);
}
