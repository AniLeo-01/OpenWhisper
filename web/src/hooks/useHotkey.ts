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
  /** "hold" = hold-to-talk (default), "toggle" = press to start, press again to stop */
  mode?: "hold" | "toggle";
}

/**
 * Push-to-talk / toggle hotkey hook.
 *
 * "hold" mode: hold the key to trigger onStart, release to trigger onStop.
 * "toggle" mode: press once to start, press again to stop.
 */
export function useHotkey({
  key = "Control",
  onStart,
  onStop,
  enabled = true,
  mode = "hold",
}: UseHotkeyOptions) {
  const isPressedRef = useRef(false);
  const isActiveRef = useRef(false); // for toggle mode
  const onStartRef = useRef(onStart);
  const onStopRef = useRef(onStop);

  onStartRef.current = onStart;
  onStopRef.current = onStop;

  const isModifierKey = (k: string) =>
    ["Control", "Alt", "Meta", "Shift"].includes(k);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;
      if (e.key !== key || e.repeat) return;

      // Don't trigger in text inputs unless it's a modifier key
      const target = e.target as HTMLElement;
      if (
        !isModifierKey(key) &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (mode === "hold") {
        if (!isPressedRef.current) {
          isPressedRef.current = true;
          onStartRef.current();
        }
      } else {
        // toggle mode
        if (!isActiveRef.current) {
          isActiveRef.current = true;
          onStartRef.current();
        } else {
          isActiveRef.current = false;
          onStopRef.current();
        }
      }
    },
    [key, enabled, mode]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== key) return;

      if (mode === "hold" && isPressedRef.current) {
        isPressedRef.current = false;
        onStopRef.current();
      }
      // toggle mode: keyup does nothing
    },
    [key, mode]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Expose a way to force-stop (for toggle mode, when we cancel externally)
  return {
    forceStop: () => {
      isPressedRef.current = false;
      isActiveRef.current = false;
    },
  };
}
