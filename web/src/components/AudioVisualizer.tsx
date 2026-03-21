"use client";

import { useEffect, useRef } from "react";

interface AudioVisualizerProps {
  audioLevel: number;
  isActive: boolean;
}

export function AudioVisualizer({ audioLevel, isActive }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const barsRef = useRef<number[]>(Array(32).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const bars = barsRef.current;
      const barWidth = width / bars.length;
      const gap = 2;

      for (let i = 0; i < bars.length; i++) {
        // Decay existing bars, boost with audio level
        const target = isActive
          ? audioLevel * (0.5 + Math.random() * 0.5)
          : 0;
        bars[i] = bars[i] * 0.85 + target * 0.15;

        const barHeight = bars[i] * height * 0.8;
        const x = i * barWidth + gap / 2;
        const y = (height - barHeight) / 2;

        // Gradient from teal to blue
        const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
        gradient.addColorStop(0, isActive ? "#06b6d4" : "#374151");
        gradient.addColorStop(1, isActive ? "#3b82f6" : "#1f2937");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth - gap, barHeight, 2);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [audioLevel, isActive]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={80}
      className="w-full max-w-xs h-20 rounded-lg"
    />
  );
}
