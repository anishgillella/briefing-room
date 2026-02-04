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

    // Track scroll speed for warp effect
    let currentScrollY = window.scrollY;
    let targetWarp = 0;
    let warpIntensity = 0;

    const handleScroll = () => {
      const newScrollY = window.scrollY;
      const delta = Math.abs(newScrollY - currentScrollY);
      targetWarp = Math.min(delta * 0.5, 50); // Cap max warp
      currentScrollY = newScrollY;
    };

    window.addEventListener("scroll", handleScroll);

    // Star interface
    interface Star {
      x: number;
      y: number;
      baseX: number;
      baseY: number;
      z: number; // Added depth for warp
      size: number;
      opacity: number;
      twinkleSpeed: number;
      twinklePhase: number;
    }

    // Generate stars with depth
    const stars: Star[] = [];
    for (let i = 0; i < starCount; i++) {
      const x = (Math.random() - 0.5) * width * 2;
      const y = (Math.random() - 0.5) * height * 2;
      const z = Math.random() * 1000;

      stars.push({
        x, y,
        baseX: x,
        baseY: y,
        z,
        size: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.5 + 0.3,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }

    let animationId: number;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Smoothly interpolate warp intensity
      warpIntensity += (targetWarp - warpIntensity) * 0.1;
      targetWarp *= 0.95; // Decay warp target if no scroll

      const centerX = width / 2;
      const centerY = height / 2;

      stars.forEach((star) => {
        // Move star towards camera based on warp
        star.z -= 2 + warpIntensity;

        // Reset if passed camera
        if (star.z <= 0) {
          star.z = 1000;
          star.x = (Math.random() - 0.5) * width * 2;
          star.y = (Math.random() - 0.5) * height * 2;
        }

        // Project 3D to 2D
        const k = 1200 / star.z;
        const px = centerX + star.x * k;
        const py = centerY + star.y * k;

        // Don't draw if out of bounds
        if (px < 0 || px > width || py < 0 || py > height) return;

        const size = star.size * k * 0.5;
        const opacity = Math.min(star.opacity, (1000 - star.z) / 200);

        // Draw star (elongate if warping)
        ctx.beginPath();
        if (warpIntensity > 2) {
          const tailLen = Math.min(warpIntensity * 2 * k, 50);
          const angle = Math.atan2(py - centerY, px - centerX);
          ctx.moveTo(px, py);
          ctx.lineTo(px - Math.cos(angle) * tailLen, py - Math.sin(angle) * tailLen);
          ctx.strokeStyle = `rgba(200, 220, 255, ${opacity})`;
          ctx.lineWidth = size;
          ctx.stroke();
        } else {
          ctx.arc(px, py, size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
          ctx.fill();
        }
      });

      animationId = requestAnimationFrame(draw);
    };

    // Check for reduced motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      // Draw static
      const centerX = width / 2;
      const centerY = height / 2;

      stars.forEach((star) => {
        const k = 1200 / star.z;
        const px = centerX + star.x * k;
        const py = centerY + star.y * k;

        if (px < 0 || px > width || py < 0 || py > height) return;

        const size = star.size * k * 0.5;
        const opacity = Math.min(star.opacity, (1000 - star.z) / 200);

        const gradient = ctx.createRadialGradient(
          px, py, 0,
          px, py, size * 3
        );
        gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
        gradient.addColorStop(0.4, `rgba(200, 220, 255, ${opacity * 0.3})`);
        gradient.addColorStop(1, `rgba(150, 180, 255, 0)`);

        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
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
