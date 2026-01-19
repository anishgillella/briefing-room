"use client";

import React, { useState, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

// =============================================================================
// DESIGN TOKENS
// =============================================================================

const tokens = {
  border: {
    default: "rgba(255, 255, 255, 0.08)",
    hover: "rgba(255, 255, 255, 0.16)",
  },
  glow: {
    primary: "rgba(79, 124, 255, 0.25)",
    cyan: "rgba(56, 189, 248, 0.20)",
  },
  spring: {
    stiff: { stiffness: 260, damping: 20 },
    soft: { stiffness: 200, damping: 25 },
    snappy: { stiffness: 400, damping: 30 },
  },
};

// =============================================================================
// MOTION CARD
// =============================================================================
// Use for all glass cards: feature cards, metric cards, step cards, mini panels

interface MotionCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  hoverScale?: number;
  hoverY?: number;
  glowColor?: string;
  onClick?: () => void;
}

export function MotionCard({
  children,
  className = "",
  style,
  hoverScale = 1.01,
  hoverY = -4,
  glowColor = tokens.glow.primary,
  onClick,
}: MotionCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className={`relative cursor-pointer ${className}`}
      style={{
        ...style,
        border: `1px solid ${isHovered ? tokens.border.hover : tokens.border.default}`,
        transition: "border-color 0.2s ease",
      }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onClick}
      whileHover={{
        y: hoverY,
        scale: hoverScale,
        boxShadow: `0 20px 40px rgba(0, 0, 0, 0.3), 0 0 30px ${glowColor}`,
      }}
      transition={tokens.spring.stiff}
    >
      {/* Hover highlight overlay */}
      <motion.div
        className="absolute inset-0 rounded-[inherit] pointer-events-none"
        style={{
          background: `linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 50%)`,
        }}
        animate={{ opacity: isHovered ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      />
      {children}
    </motion.div>
  );
}

// =============================================================================
// MOTION BUTTON (Primary CTA)
// =============================================================================
// Use for: Get Started Free, Watch Demo, etc.

interface MotionButtonProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  variant?: "primary" | "secondary" | "ghost";
  onClick?: () => void;
  href?: string;
  icon?: React.ReactNode;
}

export function MotionButton({
  children,
  className = "",
  style,
  variant = "primary",
  onClick,
  icon,
}: MotionButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  const variants = {
    primary: {
      bg: "#4F7CFF",
      hoverBg: "#3D67F2",
      shadow: "0 10px 30px rgba(79, 124, 255, 0.25)",
      hoverShadow: "0 15px 40px rgba(79, 124, 255, 0.35)",
    },
    secondary: {
      bg: "transparent",
      hoverBg: "rgba(255, 255, 255, 0.05)",
      shadow: "none",
      hoverShadow: "0 10px 30px rgba(0, 0, 0, 0.2)",
    },
    ghost: {
      bg: "transparent",
      hoverBg: "transparent",
      shadow: "none",
      hoverShadow: "none",
    },
  };

  const v = variants[variant];

  return (
    <motion.button
      className={`relative overflow-hidden ${className}`}
      style={{
        background: v.bg,
        boxShadow: v.shadow,
        ...style,
      }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onClick}
      whileHover={{
        scale: 1.02,
        boxShadow: v.hoverShadow,
      }}
      whileTap={{ scale: 0.98 }}
      transition={tokens.spring.snappy}
    >
      {/* Shimmer effect for primary */}
      {variant === "primary" && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          initial={{ x: "-100%" }}
          animate={{ x: isHovered ? "100%" : "-100%" }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        />
      )}

      <span className="relative z-10 flex items-center gap-2">
        {children}
        {icon && (
          <motion.span
            animate={{ x: isHovered ? 4 : 0 }}
            transition={tokens.spring.snappy}
          >
            {icon}
          </motion.span>
        )}
      </span>
    </motion.button>
  );
}

// =============================================================================
// TILT CARD (For Hero Preview)
// =============================================================================
// Premium tilt effect following cursor

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  tiltMaxAngle?: number;
  glowFollowsCursor?: boolean;
}

export function TiltCard({
  children,
  className = "",
  style,
  tiltMaxAngle = 6,
  glowFollowsCursor = true,
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [tiltMaxAngle, -tiltMaxAngle]), tokens.spring.soft);
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-tiltMaxAngle, tiltMaxAngle]), tokens.spring.soft);

  const glowX = useSpring(useTransform(x, [-0.5, 0.5], [0, 100]), tokens.spring.soft);
  const glowY = useSpring(useTransform(y, [-0.5, 0.5], [0, 100]), tokens.spring.soft);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const normalizedX = (e.clientX - rect.left) / rect.width - 0.5;
    const normalizedY = (e.clientY - rect.top) / rect.height - 0.5;
    x.set(normalizedX);
    y.set(normalizedY);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      className={`relative ${className}`}
      style={{
        ...style,
        perspective: 1000,
        transformStyle: "preserve-3d",
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        className="relative"
      >
        {/* Glow that follows cursor */}
        {glowFollowsCursor && (
          <motion.div
            className="absolute inset-0 rounded-[inherit] pointer-events-none opacity-0"
            style={{
              background: useTransform(
                [glowX, glowY],
                ([gx, gy]) =>
                  `radial-gradient(circle at ${gx}% ${gy}%, rgba(79, 124, 255, 0.15), transparent 50%)`
              ),
            }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.3 }}
          />
        )}
        {children}
      </motion.div>
    </motion.div>
  );
}

// =============================================================================
// MAGNETIC BUTTON (Elite polish)
// =============================================================================
// Button slightly follows cursor inside its bounds

interface MagneticButtonProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  strength?: number;
  onClick?: () => void;
}

export function MagneticButton({
  children,
  className = "",
  style,
  strength = 0.3,
  onClick,
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springX = useSpring(x, tokens.spring.snappy);
  const springY = useSpring(y, tokens.spring.snappy);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = (e.clientX - centerX) * strength;
    const deltaY = (e.clientY - centerY) * strength;
    x.set(deltaX);
    y.set(deltaY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.button
      ref={ref}
      className={className}
      style={{
        ...style,
        x: springX,
        y: springY,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={tokens.spring.snappy}
    >
      {children}
    </motion.button>
  );
}

// =============================================================================
// ANIMATED LINK (Nav links with underline animation)
// =============================================================================

interface AnimatedLinkProps {
  children: React.ReactNode;
  href?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export function AnimatedLink({
  children,
  href,
  className = "",
  style,
  onClick,
}: AnimatedLinkProps) {
  const [isHovered, setIsHovered] = useState(false);

  const Component = href ? motion.a : motion.span;

  return (
    <Component
      href={href}
      className={`relative cursor-pointer ${className}`}
      style={style}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onClick}
      animate={{ opacity: isHovered ? 1 : 0.7 }}
      transition={{ duration: 0.15 }}
    >
      {children}
      {/* Underline that slides in from left */}
      <motion.span
        className="absolute left-0 -bottom-0.5 h-px bg-current"
        initial={{ width: 0 }}
        animate={{ width: isHovered ? "100%" : 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      />
    </Component>
  );
}

// =============================================================================
// GLOW BADGE (For hero badge, pills)
// =============================================================================

interface GlowBadgeProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  glowColor?: string;
  icon?: React.ReactNode;
}

export function GlowBadge({
  children,
  className = "",
  style,
  glowColor = "rgba(56, 189, 248, 0.4)",
  icon,
}: GlowBadgeProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.span
      className={`inline-flex items-center gap-2 ${className}`}
      style={style}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{
        boxShadow: `0 0 20px ${glowColor}`,
      }}
      transition={tokens.spring.soft}
    >
      {icon && (
        <motion.span
          animate={{ rotate: isHovered ? 15 : 0 }}
          transition={tokens.spring.snappy}
        >
          {icon}
        </motion.span>
      )}
      {children}
    </motion.span>
  );
}

// =============================================================================
// INTERACTIVE ICON (Wiggles/pulses on hover)
// =============================================================================

interface InteractiveIconProps {
  children: React.ReactNode;
  className?: string;
  animation?: "wiggle" | "pulse" | "bounce" | "spin";
}

export function InteractiveIcon({
  children,
  className = "",
  animation = "wiggle",
}: InteractiveIconProps) {
  const [isHovered, setIsHovered] = useState(false);

  const animations = {
    wiggle: { rotate: [0, -10, 10, -10, 0] },
    pulse: { scale: [1, 1.2, 1] },
    bounce: { y: [0, -4, 0] },
    spin: { rotate: 360 },
  };

  return (
    <motion.span
      className={`inline-flex ${className}`}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      animate={isHovered ? animations[animation] : {}}
      transition={{ duration: 0.4, ease: "easeInOut" }}
    >
      {children}
    </motion.span>
  );
}
