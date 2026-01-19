"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

// =============================================================================
// STARFIELD BACKGROUND
// =============================================================================
// Elegant, minimalist starfield with small floating dots
// Glassmorphism-friendly, subtle and majestic

interface StarfieldBackgroundProps {
  starCount?: number;
  showPulseRings?: boolean;
  className?: string;
}

export default function StarfieldBackground({
  starCount = 80,
  showPulseRings = true,
  className = "",
}: StarfieldBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const setCanvasSize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    setCanvasSize();
    window.addEventListener("resize", setCanvasSize);

    // Star interface
    interface Star {
      x: number;
      y: number;
      baseX: number;
      baseY: number;
      size: number;
      opacity: number;
      twinkleSpeed: number;
      twinklePhase: number;
      floatSpeed: number;
      floatPhase: number;
      floatRadius: number;
    }

    // Generate elegant, small stars
    const stars: Star[] = [];

    for (let i = 0; i < starCount; i++) {
      // Smaller sizes for minimalist look
      let size: number;
      const sizeRoll = Math.random();
      if (sizeRoll < 0.6) {
        size = Math.random() * 0.8 + 0.5; // 60% tiny (0.5-1.3px)
      } else if (sizeRoll < 0.9) {
        size = Math.random() * 0.7 + 1.2; // 30% small (1.2-1.9px)
      } else {
        size = Math.random() * 0.8 + 1.8; // 10% medium (1.8-2.6px)
      }

      const baseX = Math.random() * width;
      const baseY = Math.random() * height;

      stars.push({
        x: baseX,
        y: baseY,
        baseX,
        baseY,
        size,
        opacity: Math.random() * 0.4 + 0.2, // 0.2-0.6 (subtle)
        twinkleSpeed: Math.random() * 0.008 + 0.003, // Slower twinkle
        twinklePhase: Math.random() * Math.PI * 2,
        floatSpeed: Math.random() * 0.0008 + 0.0003, // Very slow float
        floatPhase: Math.random() * Math.PI * 2,
        floatRadius: Math.random() * 15 + 8, // Gentle float radius (8-23px)
      });
    }

    let animationId: number;
    let time = 0;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      stars.forEach((star) => {
        // Gentle floating motion
        const floatX = Math.sin(time * star.floatSpeed + star.floatPhase) * star.floatRadius;
        const floatY = Math.cos(time * star.floatSpeed * 0.7 + star.floatPhase) * star.floatRadius * 0.6;

        star.x = star.baseX + floatX;
        star.y = star.baseY + floatY;

        // Wrap around screen
        if (star.x < -20) star.baseX = width + 20;
        if (star.x > width + 20) star.baseX = -20;
        if (star.y < -20) star.baseY = height + 20;
        if (star.y > height + 20) star.baseY = -20;

        // Gentle twinkle
        const twinkle = Math.sin(time * star.twinkleSpeed + star.twinklePhase) * 0.5 + 0.5;
        const currentOpacity = star.opacity * (0.6 + twinkle * 0.4);

        // Draw star with soft glow
        const gradient = ctx.createRadialGradient(
          star.x, star.y, 0,
          star.x, star.y, star.size * 3
        );
        gradient.addColorStop(0, `rgba(255, 255, 255, ${currentOpacity})`);
        gradient.addColorStop(0.4, `rgba(200, 220, 255, ${currentOpacity * 0.4})`);
        gradient.addColorStop(1, `rgba(150, 180, 255, 0)`);

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Crisp center dot
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${currentOpacity * 1.2})`;
        ctx.fill();
      });

      time += 1;
      animationId = requestAnimationFrame(draw);
    };

    // Check for reduced motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      // Draw static
      stars.forEach((star) => {
        const gradient = ctx.createRadialGradient(
          star.x, star.y, 0,
          star.x, star.y, star.size * 3
        );
        gradient.addColorStop(0, `rgba(255, 255, 255, ${star.opacity})`);
        gradient.addColorStop(0.4, `rgba(200, 220, 255, ${star.opacity * 0.3})`);
        gradient.addColorStop(1, `rgba(150, 180, 255, 0)`);

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      });
    } else {
      draw();
    }

    return () => {
      window.removeEventListener("resize", setCanvasSize);
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [isClient, starCount]);

  if (!isClient) {
    return <div className="fixed inset-0 bg-[#070A12]" style={{ zIndex: 0 }} />;
  }

  return (
    <div
      className={`fixed inset-0 overflow-hidden pointer-events-none ${className}`}
      style={{ zIndex: 0 }}
    >
      {/* Base dark background */}
      <div
        className="absolute inset-0"
        style={{ background: "#070A12" }}
      />

      {/* Subtle gradient hazes for depth */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 70% 50% at 10% 20%, rgba(79, 124, 255, 0.12), transparent 50%),
            radial-gradient(ellipse 50% 40% at 85% 75%, rgba(56, 189, 248, 0.08), transparent 50%)
          `,
        }}
      />

      {/* Star canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ display: "block" }}
      />

      {/* Elegant pulse rings - very subtle */}
      {showPulseRings && (
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute rounded-full"
            style={{
              top: "25%",
              right: "8%",
              width: 400,
              height: 400,
              border: "1px solid rgba(79, 124, 255, 0.08)",
              transform: "translate(50%, -50%)",
            }}
            animate={{
              scale: [1, 1.4, 1],
              opacity: [0.3, 0, 0.3],
            }}
            transition={{
              duration: 12,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute rounded-full"
            style={{
              bottom: "20%",
              left: "5%",
              width: 300,
              height: 300,
              border: "1px solid rgba(56, 189, 248, 0.06)",
              transform: "translate(-50%, 50%)",
            }}
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.2, 0, 0.2],
            }}
            transition={{
              duration: 15,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 5,
            }}
          />
        </div>
      )}

      {/* Subtle vignette for depth */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 120% 100% at 50% 50%, transparent 50%, rgba(7, 10, 18, 0.3) 100%)`,
        }}
      />
    </div>
  );
}
