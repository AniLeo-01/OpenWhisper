"use client";

import { useAppStore } from "@/lib/store";
import { useState } from "react";
import { Save, Plus, X, Eye, EyeOff, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const [saved, setSaved] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [newWord, setNewWord] = useState("");

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addDictionaryWord = () => {
    const word = newWord.trim();
    if (word && !settings.personalDictionary.includes(word)) {
      updateSettings({
        personalDictionary: [...settings.personalDictionary, word],
      });
      setNewWord("");
    }
  };

  const removeDictionaryWord = (word: string) => {
    updateSettings({
      personalDictionary: settings.personalDictionary.filter((w) => w !== word),
    });
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-10">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="p-2 text-gray-500 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-gray-400 text-sm mt-1">
            Configure your dictation experience
          </p>
        </div>
      </div>

      {/* ─── STT Engine ─────────────────────────────────────────── */}
      <Section title="Speech-to-Text Engine">
        <Select
          label="Engine"
          value={settings.sttEngine}
          onChange={(v) => updateSettings({ sttEngine: v as "groq" | "self-hosted" })}
          options={[
            { value: "groq", label: "Groq Whisper API (cloud, fast)" },
            { value: "self-hosted", label: "Self-hosted Whisper (local, private)" },
          ]}
        />

        {settings.sttEngine === "groq" && (
          <ApiKeyInput
            label="Groq API Key"
            value={settings.groqApiKey}
            onChange={(v) => updateSettings({ groqApiKey: v })}
            show={showGroqKey}
            onToggle={() => setShowGroqKey(!showGroqKey)}
            helpText={
              <>
                Get a free key at{" "}
                <a
                  href="https://console.groq.com"
                  target="_blank"
                  className="text-cyan-400 hover:underline"
                >
                  console.groq.com
                </a>
              </>
            }
          />
        )}

        {settings.sttEngine === "self-hosted" && (
          <TextInput
            label="Server URL"
            value={settings.selfHostedUrl}
            onChange={(v) => updateSettings({ selfHostedUrl: v })}
            placeholder="http://localhost:8000"
          />
        )}

        <Select
          label="Language"
          value={settings.language}
          onChange={(v) => updateSettings({ language: v })}
          options={[
            { value: "auto", label: "Auto-detect" },
            { value: "en", label: "English" },
            { value: "es", label: "Spanish" },
            { value: "fr", label: "French" },
            { value: "de", label: "German" },
            { value: "hi", label: "Hindi" },
            { value: "ja", label: "Japanese" },
            { value: "zh", label: "Chinese" },
            { value: "ar", label: "Arabic" },
            { value: "pt", label: "Portuguese" },
            { value: "ko", label: "Korean" },
          ]}
        />
      </Section>

      {/* ─── AI Post-Processing ─────────────────────────────────── */}
      <Section title="AI Post-Processing">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-200">Enable AI cleanup</p>
            <p className="text-xs text-gray-500">
              Removes filler words, fixes grammar, adjusts tone
            </p>
          </div>
          <button
            onClick={() => updateSettings({ postProcess: !settings.postProcess })}
            className={`w-11 h-6 rounded-full transition-colors ${
              settings.postProcess ? "bg-cyan-500" : "bg-gray-700"
            }`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full transition-transform shadow ${
                settings.postProcess ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {settings.postProcess && (
          <>
            <Select
              label="AI Provider"
              value={settings.aiProvider}
              onChange={(v) =>
                updateSettings({
                  aiProvider: v as "groq" | "openai" | "ollama" | "none",
                })
              }
              options={[
                { value: "groq", label: "Groq (Llama 3.3, fast & free)" },
                { value: "openai", label: "OpenAI (GPT-4o-mini)" },
                { value: "ollama", label: "Ollama (local LLM)" },
                { value: "none", label: "None (disable)" },
              ]}
            />

            {settings.aiProvider === "openai" && (
              <ApiKeyInput
                label="OpenAI API Key"
                value={settings.openaiApiKey}
                onChange={(v) => updateSettings({ openaiApiKey: v })}
                show={showOpenAIKey}
                onToggle={() => setShowOpenAIKey(!showOpenAIKey)}
              />
            )}

            {settings.aiProvider === "ollama" && (
              <TextInput
                label="Ollama URL"
                value={settings.ollamaUrl}
                onChange={(v) => updateSettings({ ollamaUrl: v })}
                placeholder="http://localhost:11434"
              />
            )}

            <Select
              label="Tone"
              value={settings.tone}
              onChange={(v) =>
                updateSettings({
                  tone: v as "auto" | "casual" | "professional" | "technical",
                })
              }
              options={[
                { value: "auto", label: "Auto (match context)" },
                { value: "casual", label: "Casual" },
                { value: "professional", label: "Professional" },
                { value: "technical", label: "Technical" },
              ]}
            />
          </>
        )}
      </Section>

      {/* ─── Hotkey ──────────────────────────────────────────────── */}
      <Section title="Hotkey">
        <Select
          label="Push-to-talk key"
          value={settings.hotkey}
          onChange={(v) => updateSettings({ hotkey: v })}
          options={[
            { value: "Control", label: "Ctrl / Control" },
            { value: "Alt", label: "Alt / Option" },
            { value: "Shift", label: "Shift" },
            { value: " ", label: "Space (caution: may conflict with typing)" },
          ]}
        />
      </Section>

      {/* ─── Personal Dictionary ────────────────────────────────── */}
      <Section title="Personal Dictionary" id="dictionary">
        <p className="text-xs text-gray-500 -mt-2 mb-3">
          Add names, jargon, or technical terms that should be transcribed exactly.
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addDictionaryWord()}
            placeholder="Add a word or phrase..."
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={addDictionaryWord}
            className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-lg px-3 py-2 hover:bg-cyan-500/20 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {settings.personalDictionary.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {settings.personalDictionary.map((word) => (
              <span
                key={word}
                className="inline-flex items-center gap-1 bg-gray-800 text-gray-300 text-sm px-3 py-1 rounded-full"
              >
                {word}
                <button
                  onClick={() => removeDictionaryWord(word)}
                  className="text-gray-500 hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </Section>

      {/* Save indicator */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 bg-cyan-500 text-white px-5 py-2.5 rounded-lg hover:bg-cyan-400 transition-colors font-medium text-sm"
        >
          <Save className="w-4 h-4" />
          {saved ? "Saved!" : "Settings auto-save"}
        </button>
      </div>
    </div>
  );
}

// ─── Reusable Components ─────────────────────────────────────────────

function Section({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-200 border-b border-gray-800 pb-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm text-gray-300 shrink-0">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cyan-500 min-w-[200px]"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm text-gray-300 shrink-0">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500 min-w-[200px]"
      />
    </div>
  );
}

function ApiKeyInput({
  label,
  value,
  onChange,
  show,
  onToggle,
  helpText,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  helpText?: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-4">
        <label className="text-sm text-gray-300 shrink-0">{label}</label>
        <div className="relative min-w-[200px]">
          <input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="sk-..."
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 pr-9 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500"
          />
          <button
            type="button"
            onClick={onToggle}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {helpText && (
        <p className="text-xs text-gray-600 text-right">{helpText}</p>
      )}
    </div>
  );
}
