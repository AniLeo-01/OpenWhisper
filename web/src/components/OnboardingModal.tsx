"use client";

import { useState } from "react";
import { Mic, Keyboard, Sparkles, ArrowRight, Check } from "lucide-react";

interface OnboardingModalProps {
  onComplete: (groqApiKey: string) => void;
}

const steps = [
  {
    icon: Mic,
    title: "Voice dictation, reimagined",
    description:
      "Hold a key, speak naturally, and get polished text — filler words removed, grammar fixed, tone adjusted automatically.",
  },
  {
    icon: Keyboard,
    title: "Hold to dictate, release to paste",
    description:
      "Press and hold Ctrl to record. Speak at a natural pace. Release when done — your cleaned text appears instantly.",
  },
  {
    icon: Sparkles,
    title: "Command Mode",
    description:
      "Select any text, then press Ctrl+Shift to speak a command: \"make this more concise\", \"translate to Spanish\", \"rewrite as bullet points\".",
  },
];

/**
 * First-run onboarding modal. Mirrors Wispr Flow's setup:
 * 1. Welcome + feature overview
 * 2. API key setup (Groq - free)
 * 3. Mic test
 */
export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const [apiKey, setApiKey] = useState("");
  const [micTested, setMicTested] = useState(false);
  const [micWorking, setMicWorking] = useState(false);

  const testMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicTested(true);
      setMicWorking(true);
    } catch {
      setMicTested(true);
      setMicWorking(false);
    }
  };

  const isLastIntroStep = step === steps.length - 1;
  const isApiStep = step === steps.length;
  const isMicStep = step === steps.length + 1;

  const handleNext = () => {
    if (isMicStep) {
      onComplete(apiKey);
    } else {
      setStep(step + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-gray-950 border border-gray-800 rounded-2xl max-w-md w-full p-8 shadow-2xl">
        {/* Feature intro steps */}
        {step < steps.length && (
          <div className="space-y-6">
            {/* Step indicator */}
            <div className="flex items-center gap-2 justify-center">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === step ? "bg-cyan-400" : i < step ? "bg-cyan-800" : "bg-gray-700"
                  }`}
                />
              ))}
              <div className={`w-2 h-2 rounded-full ${isApiStep ? "bg-cyan-400" : "bg-gray-700"}`} />
              <div className={`w-2 h-2 rounded-full ${isMicStep ? "bg-cyan-400" : "bg-gray-700"}`} />
            </div>

            {/* Content */}
            <div className="text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/20 flex items-center justify-center">
                {(() => {
                  const Icon = steps[step].icon;
                  return <Icon className="w-7 h-7 text-cyan-400" />;
                })()}
              </div>
              <h2 className="text-xl font-semibold text-white">
                {steps[step].title}
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                {steps[step].description}
              </p>
            </div>

            <button
              onClick={handleNext}
              className="w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-white font-medium py-2.5 rounded-xl transition-colors"
            >
              {isLastIntroStep ? "Set up API key" : "Next"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* API Key step */}
        {isApiStep && (
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <h2 className="text-xl font-semibold text-white">
                Connect to Groq
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                OpenWhisper uses Groq for ultra-fast transcription. Get a free
                API key at{" "}
                <a
                  href="https://console.groq.com"
                  target="_blank"
                  rel="noopener"
                  className="text-cyan-400 hover:underline"
                >
                  console.groq.com
                </a>
              </p>
            </div>

            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="gsk_..."
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setStep(step - 1)}
                className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleNext}
                className="flex-1 flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-white font-medium py-2.5 rounded-xl transition-colors"
              >
                {apiKey ? "Continue" : "Skip for now"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Mic test step */}
        {isMicStep && (
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <h2 className="text-xl font-semibold text-white">
                Test your microphone
              </h2>
              <p className="text-gray-400 text-sm">
                Make sure your mic is working before you start dictating.
              </p>
            </div>

            <button
              onClick={testMicrophone}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border transition-colors ${
                micTested && micWorking
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : micTested && !micWorking
                  ? "border-red-500/30 bg-red-500/10 text-red-400"
                  : "border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-600"
              }`}
            >
              {micTested && micWorking ? (
                <>
                  <Check className="w-5 h-5" />
                  Microphone works!
                </>
              ) : micTested && !micWorking ? (
                <>
                  <Mic className="w-5 h-5" />
                  Mic not detected — check permissions
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5" />
                  Test microphone
                </>
              )}
            </button>

            <button
              onClick={handleNext}
              className="w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-white font-medium py-2.5 rounded-xl transition-colors"
            >
              Start dictating
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
