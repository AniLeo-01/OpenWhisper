"use client";

import { useState, useRef, useCallback } from "react";

export interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioLevel: number;
}

export interface UseAudioRecorderReturn {
  state: AudioRecorderState;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob>;
  cancelRecording: () => void;
}

/** Minimum recording duration in ms to consider it valid speech */
const MIN_DURATION_MS = 400;

/**
 * Minimum peak audio level (0–1) during recording to consider it speech.
 * Below this, it's silence/noise and we discard to prevent Whisper hallucination.
 */
const MIN_PEAK_LEVEL = 0.04;

/**
 * Minimum percentage of frames that exceeded the speech threshold.
 * Prevents sending clips that had one brief pop but were otherwise silent.
 */
const MIN_SPEECH_RATIO = 0.05;

/** Audio level threshold to count a frame as "speech" */
const SPEECH_THRESHOLD = 0.03;

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioLevel: 0,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Track audio energy to detect silence
  const peakLevelRef = useRef<number>(0);
  const speechFramesRef = useRef<number>(0);
  const totalFramesRef = useRef<number>(0);

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    const avg = data.reduce((sum, val) => sum + val, 0) / data.length;
    const normalized = Math.min(avg / 128, 1);

    // Track peak and speech frames
    totalFramesRef.current++;
    if (normalized > peakLevelRef.current) {
      peakLevelRef.current = normalized;
    }
    if (normalized > SPEECH_THRESHOLD) {
      speechFramesRef.current++;
    }

    setState((prev) => ({ ...prev, audioLevel: normalized }));
    animFrameRef.current = requestAnimationFrame(updateAudioLevel);
  }, []);

  const startRecording = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 16000,
      },
    });

    streamRef.current = stream;
    chunksRef.current = [];

    // Reset energy tracking
    peakLevelRef.current = 0;
    speechFramesRef.current = 0;
    totalFramesRef.current = 0;

    // Set up audio analyser for level metering
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    // Use webm/opus for good compression + quality
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    const mediaRecorder = new MediaRecorder(stream, { mimeType });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(100); // Collect data every 100ms

    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setState((prev) => ({
        ...prev,
        duration: Math.floor((Date.now() - startTimeRef.current) / 1000),
      }));
    }, 1000);

    setState({
      isRecording: true,
      isPaused: false,
      duration: 0,
      audioLevel: 0,
    });

    updateAudioLevel();
  }, [updateAudioLevel]);

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
    }
    setState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      audioLevel: 0,
    });
  }, []);

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder || mediaRecorder.state === "inactive") {
        cleanup();
        resolve(new Blob());
        return;
      }

      const recordingDuration = Date.now() - startTimeRef.current;
      const peakLevel = peakLevelRef.current;
      const speechRatio =
        totalFramesRef.current > 0
          ? speechFramesRef.current / totalFramesRef.current
          : 0;

      mediaRecorder.onstop = () => {
        cleanup();

        // ─── Silence gate: discard if no real speech detected ────
        // This prevents Whisper from hallucinating on silent/short clips
        if (recordingDuration < MIN_DURATION_MS) {
          console.log(
            `[OpenWhisper] Discarded: too short (${recordingDuration}ms < ${MIN_DURATION_MS}ms)`
          );
          resolve(new Blob());
          return;
        }

        if (peakLevel < MIN_PEAK_LEVEL) {
          console.log(
            `[OpenWhisper] Discarded: silent (peak=${peakLevel.toFixed(3)} < ${MIN_PEAK_LEVEL})`
          );
          resolve(new Blob());
          return;
        }

        if (speechRatio < MIN_SPEECH_RATIO) {
          console.log(
            `[OpenWhisper] Discarded: mostly silence (speechRatio=${(speechRatio * 100).toFixed(1)}% < ${MIN_SPEECH_RATIO * 100}%)`
          );
          resolve(new Blob());
          return;
        }

        const blob = new Blob(chunksRef.current, {
          type: mediaRecorder.mimeType,
        });
        resolve(blob);
      };

      mediaRecorder.stop();
    });
  }, [cleanup]);

  const cancelRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    chunksRef.current = [];
    cleanup();
  }, [cleanup]);

  return { state, startRecording, stopRecording, cancelRecording };
}
