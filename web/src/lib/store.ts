import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ExtensionResult } from "./extensions/types";

// ─── Types ────────────────────────────────────────────────────────

export interface TranscriptionEntry {
  id: string;
  rawText: string;
  cleanedText: string;
  timestamp: number;
  duration: number;
  language: string;
  engine: string;
}

export interface SessionSegment {
  id: string;
  rawText: string;
  cleanedText: string;
  timestamp: number;
}

export interface Settings {
  sttEngine: "groq" | "self-hosted";
  groqApiKey: string;
  selfHostedUrl: string;
  language: string;
  postProcess: boolean;
  aiProvider: "groq" | "openai" | "ollama" | "none";
  openaiApiKey: string;
  ollamaUrl: string;
  tone: "auto" | "casual" | "professional" | "technical";
  hotkeyDictate: string;
  hotkeyHandsFree: string;
  hotkeyCommand: string;
  hotkeyNewSession: string;
  personalDictionary: string[];
  tavilyApiKey: string;
}

export interface AppStore {
  // Session state
  sessionCleanedText: string;
  sessionRawText: string;
  latestCleanedSegment: string;
  sessionSegments: SessionSegment[];

  // Command mode state
  commandModeActive: boolean;
  commandResult: ExtensionResult | null;

  // History
  history: TranscriptionEntry[];

  // Settings
  settings: Settings;

  // Session methods
  appendSegment(segment: {
    id: string;
    rawText: string;
    cleanedText: string;
    timestamp: number;
  }): void;
  getSessionContext(): string;
  newSession(): void;
  loadIntoSession(text: string): void;

  // Command mode methods
  setCommandModeActive(active: boolean): void;
  setCommandResult(result: ExtensionResult | null): void;

  // History methods
  addToHistory(entry: TranscriptionEntry): void;
  clearHistory(): void;

  // Settings methods
  updateSettings(updates: Partial<Settings>): void;
}

// ─── Default Settings ─────────────────────────────────────────────

const defaultSettings: Settings = {
  sttEngine: "groq",
  groqApiKey: "",
  selfHostedUrl: "http://localhost:8000",
  language: "auto",
  postProcess: true,
  aiProvider: "groq",
  openaiApiKey: "",
  ollamaUrl: "http://localhost:11434",
  tone: "auto",
  hotkeyDictate: "Control",
  hotkeyHandsFree: "Alt",
  hotkeyCommand: "Shift",
  hotkeyNewSession: "N",
  personalDictionary: [],
  tavilyApiKey: "",
};

// ─── Store ────────────────────────────────────────────────────────

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Initial state
      sessionCleanedText: "",
      sessionRawText: "",
      latestCleanedSegment: "",
      sessionSegments: [],
      commandModeActive: false,
      commandResult: null,
      history: [],
      settings: defaultSettings,

      appendSegment(segment) {
        const state = get();
        const separator = state.sessionCleanedText ? " " : "";
        const rawSeparator = state.sessionRawText ? " " : "";
        set({
          sessionCleanedText: state.sessionCleanedText + separator + segment.cleanedText,
          sessionRawText: state.sessionRawText + rawSeparator + segment.rawText,
          latestCleanedSegment: segment.cleanedText,
          sessionSegments: [...state.sessionSegments, segment],
        });
      },

      getSessionContext() {
        return get().sessionCleanedText;
      },

      newSession() {
        set({
          sessionCleanedText: "",
          sessionRawText: "",
          latestCleanedSegment: "",
          sessionSegments: [],
          commandResult: null,
        });
      },

      loadIntoSession(text: string) {
        set({
          sessionCleanedText: text,
          sessionRawText: text,
          latestCleanedSegment: "",
          sessionSegments: [],
        });
      },

      setCommandModeActive(active: boolean) {
        set({ commandModeActive: active });
        if (!active) {
          // Clear result when exiting command mode
        }
      },

      setCommandResult(result: ExtensionResult | null) {
        set({ commandResult: result });
      },

      addToHistory(entry: TranscriptionEntry) {
        set((state) => ({
          history: [entry, ...state.history],
        }));
      },

      clearHistory() {
        set({ history: [] });
      },

      updateSettings(updates: Partial<Settings>) {
        set((state) => ({
          settings: { ...state.settings, ...updates },
        }));
      },
    }),
    {
      name: "openwhisper-store",
      partialize: (state) => ({
        history: state.history,
        settings: state.settings,
      }),
    }
  )
);
