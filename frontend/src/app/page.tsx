"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowRight,
  Play,
  Shield,
  Clock,
  CreditCard,
  Sparkles,
  ChevronRight,
  Zap,
  Target,
  BarChart3,
  Brain,
  Users,
  FileText,
  TrendingUp,
  Briefcase,
  Search,
  Video,
  PieChart,
  Gift,
  Check,
} from "lucide-react";
import {
  motion,
  AnimatePresence,
  useInView,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";

// Dynamically import background components
const StarfieldBackground = dynamic(
  () => import("@/components/StarfieldBackground"),
  {
    ssr: false,
    loading: () => <div className="fixed inset-0 bg-[#070A12]" />,
  }
);

// =============================================================================
// DESIGN TOKENS (Matching Auth Page)
// =============================================================================

const colors = {
  pageBg: "#070A12",
  surface: "#0C1120",
  cardBg: "rgba(12, 17, 32, 0.72)",
  cardBorder: "rgba(255, 255, 255, 0.08)",
  cardBorderHover: "rgba(255, 255, 255, 0.16)",
  titleText: "#EAF0FF",
  subtitleText: "#C8D1E8",
  mutedText: "#8892AD",
  primary: "#4F7CFF",
  primaryHover: "#3D67F2",
  primaryGlow: "0 10px 30px rgba(79, 124, 255, 0.25)",
  primaryGlowHover: "0 15px 40px rgba(79, 124, 255, 0.35)",
  accentCyan: "#38BDF8",
  accentCyanGlow: "rgba(56, 189, 248, 0.4)",
  accentAmber: "#FFB020",
  accentGreen: "#22C55E",
  accentRed: "#EF4444",
};

// Spring configurations for smooth interactions
const springs = {
  stiff: { stiffness: 260, damping: 20 },
  soft: { stiffness: 200, damping: 25 },
  snappy: { stiffness: 400, damping: 30 },
};

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

const staggerContainer = {
  animate: {
    transition: { staggerChildren: 0.08 },
  },
};

const staggerItem = {
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

// =============================================================================
// GLASS NAVBAR
// =============================================================================

// Animated nav link with sliding underline
function AnimatedNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Link
      href={href}
      className="relative text-sm font-medium py-1"
      style={{ color: isHovered ? colors.titleText : colors.mutedText }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      <motion.span
        className="absolute left-0 -bottom-0.5 h-px"
        style={{ background: colors.primary }}
        initial={{ width: 0 }}
        animate={{ width: isHovered ? "100%" : 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      />
    </Link>
  );
}

function GlassNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [navHovered, setNavHovered] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="fixed top-4 left-0 right-0 z-50 px-4"
    >
      <motion.nav
        className="max-w-[1440px] mx-auto rounded-2xl px-6 py-3"
        style={{
          background: scrolled || navHovered ? "rgba(12, 17, 32, 0.85)" : "rgba(12, 17, 32, 0.55)",
          backdropFilter: scrolled || navHovered ? "blur(24px)" : "blur(20px)",
          border: `1px solid ${navHovered ? colors.cardBorderHover : colors.cardBorder}`,
          boxShadow: scrolled ? "0 8px 32px rgba(0, 0, 0, 0.3)" : "none",
        }}
        onMouseEnter={() => setNavHovered(true)}
        onMouseLeave={() => setNavHovered(false)}
        animate={{
          borderColor: navHovered ? colors.cardBorderHover : colors.cardBorder,
        }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <motion.div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: colors.primary }}
              whileHover={{ scale: 1.05, boxShadow: `0 0 20px ${colors.primary}50` }}
              transition={springs.snappy}
            >
              <Sparkles className="w-5 h-5 text-white" />
            </motion.div>
            <span className="text-lg font-semibold group-hover:text-white transition-colors" style={{ color: colors.titleText }}>
              Hirely
            </span>
          </Link>

          {/* Nav Links - Desktop */}
          <div className="hidden md:flex items-center gap-8">
            {["Features", "How it Works", "Pricing"].map((item) => (
              <AnimatedNavLink
                key={item}
                href={`#${item.toLowerCase().replace(/\s/g, "-")}`}
              >
                {item}
              </AnimatedNavLink>
            ))}
          </div>

          {/* CTA */}
          <div className="flex items-center gap-3">
            <AnimatedNavLink href="/auth">
              <span className="hidden sm:inline">Sign In</span>
            </AnimatedNavLink>
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={springs.snappy}
            >
              <Link
                href="/auth?tab=signup"
                className="relative px-4 py-2 rounded-xl text-sm font-semibold text-white overflow-hidden block"
                style={{
                  background: colors.primary,
                  boxShadow: colors.primaryGlow,
                }}
              >
                <motion.span
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  initial={{ x: "-100%" }}
                  whileHover={{ x: "100%" }}
                  transition={{ duration: 0.5 }}
                />
                <span className="relative z-10">Get Started Free</span>
              </Link>
            </motion.div>
          </div>
        </div>
      </motion.nav>
    </motion.header>
  );
}

// =============================================================================
// TILT CARD WRAPPER (For Hero Preview)
// =============================================================================

interface TiltCardWrapperProps {
  children: React.ReactNode;
  className?: string;
  tiltMaxAngle?: number;
}

function TiltCardWrapper({ children, className = "", tiltMaxAngle = 6 }: TiltCardWrapperProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [tiltMaxAngle, -tiltMaxAngle]), springs.soft);
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-tiltMaxAngle, tiltMaxAngle]), springs.soft);

  const glowX = useSpring(useTransform(x, [-0.5, 0.5], [0, 100]), springs.soft);
  const glowY = useSpring(useTransform(y, [-0.5, 0.5], [0, 100]), springs.soft);

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
        <motion.div
          className="absolute inset-0 rounded-[20px] pointer-events-none"
          style={{
            background: useTransform(
              [glowX, glowY],
              ([gx, gy]) =>
                `radial-gradient(circle at ${gx}% ${gy}%, rgba(79, 124, 255, 0.15), transparent 50%)`
            ),
            opacity: isHovered ? 1 : 0,
          }}
          transition={{ duration: 0.3 }}
        />
        {children}
      </motion.div>
    </motion.div>
  );
}

// =============================================================================
// PIPELINE PREVIEW CARD (Animated)
// =============================================================================

function PipelinePreviewCard() {
  const [activeStage, setActiveStage] = useState(3);
  const [showChip, setShowChip] = useState(false);

  const stages = [
    { name: "Job Profile", icon: Briefcase },
    { name: "Sourcing", icon: Search },
    { name: "Screen", icon: FileText },
    { name: "Interview", icon: Video },
    { name: "Analysis", icon: PieChart },
    { name: "Offer", icon: Gift },
  ];

  const candidates = [
    { name: "Sarah C.", score: 92, signal: "Strong Hire", signalColor: colors.accentGreen },
    { name: "Daniel R.", score: 78, signal: "Needs Evidence", signalColor: colors.accentAmber },
    { name: "Priya K.", score: 85, signal: "Strong", signalColor: colors.accentGreen },
  ];

  // Animate pipeline progression
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStage((prev) => (prev + 1) % stages.length);
      setShowChip(true);
      setTimeout(() => setShowChip(false), 2000);
    }, 4000);
    return () => clearInterval(interval);
  }, [stages.length]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 25, delay: 0.4 }}
      className="relative"
    >
      {/* Floating animation */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="rounded-[20px] p-6 relative overflow-hidden"
        style={{
          background: colors.cardBg,
          border: `1px solid ${colors.cardBorder}`,
          boxShadow: "0 30px 90px rgba(0, 0, 0, 0.45)",
        }}
      >
        {/* Inner highlight */}
        <div
          className="absolute top-0 left-4 right-4 h-px"
          style={{
            background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)`,
          }}
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span
              className="px-3 py-1 rounded-full text-xs font-medium"
              style={{ background: "rgba(79, 124, 255, 0.15)", color: colors.primary }}
            >
              Role: Founding Engineer
            </span>
            <span
              className="px-3 py-1 rounded-full text-xs font-medium"
              style={{ background: "rgba(56, 189, 248, 0.15)", color: colors.accentCyan }}
            >
              Stage: {stages[activeStage].name}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: colors.accentAmber }}
            />
            <span className="text-xs font-medium" style={{ color: colors.accentAmber }}>
              LIVE
            </span>
          </div>
        </div>

        {/* Pipeline Stages */}
        <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-2">
          {stages.map((stage, i) => {
            const Icon = stage.icon;
            const isActive = i === activeStage;
            const isPast = i < activeStage;

            return (
              <div key={stage.name} className="flex items-center">
                <motion.div
                  className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg transition-all"
                  animate={{
                    background: isActive ? "rgba(79, 124, 255, 0.15)" : "transparent",
                    scale: isActive ? 1.05 : 1,
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                    style={{
                      background: isActive
                        ? colors.primary
                        : isPast
                        ? "rgba(34, 197, 94, 0.2)"
                        : "rgba(255, 255, 255, 0.05)",
                      boxShadow: isActive ? `0 0 20px ${colors.primary}40` : "none",
                    }}
                  >
                    {isPast ? (
                      <Check className="w-4 h-4" style={{ color: colors.accentGreen }} />
                    ) : (
                      <Icon
                        className="w-4 h-4"
                        style={{ color: isActive ? "white" : colors.mutedText }}
                      />
                    )}
                  </div>
                  <span
                    className="text-[10px] font-medium whitespace-nowrap"
                    style={{ color: isActive ? colors.titleText : colors.mutedText }}
                  >
                    {stage.name}
                  </span>
                </motion.div>
                {i < stages.length - 1 && (
                  <div
                    className="w-4 h-0.5 mx-1 rounded-full transition-all"
                    style={{
                      background: isPast
                        ? colors.accentGreen
                        : i === activeStage
                        ? `linear-gradient(90deg, ${colors.primary}, ${colors.mutedText}40)`
                        : "rgba(255, 255, 255, 0.1)",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Candidate Cards */}
        <div className="space-y-2">
          {candidates.map((candidate, i) => (
            <motion.div
              key={candidate.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + i * 0.1 }}
              className="flex items-center justify-between p-3 rounded-xl"
              style={{ background: "rgba(255, 255, 255, 0.03)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
                  style={{ background: "rgba(79, 124, 255, 0.2)", color: colors.primary }}
                >
                  {candidate.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: colors.titleText }}>
                    {candidate.name}
                  </p>
                  <p className="text-xs" style={{ color: colors.mutedText }}>
                    Fit Score:{" "}
                    <span style={{ fontFamily: "JetBrains Mono, monospace", color: colors.accentCyan }}>
                      {candidate.score}
                    </span>
                  </p>
                </div>
              </div>
              <span
                className="px-2 py-1 rounded-md text-xs font-medium"
                style={{
                  background: `${candidate.signalColor}15`,
                  color: candidate.signalColor,
                }}
              >
                {candidate.signal}
              </span>
            </motion.div>
          ))}
        </div>

        {/* AI Chip Animation */}
        <AnimatePresence>
          {showChip && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.9 }}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2"
              style={{
                background: "rgba(56, 189, 248, 0.15)",
                border: `1px solid ${colors.accentCyan}40`,
                color: colors.accentCyan,
              }}
            >
              <Zap className="w-3 h-3" />
              AI: &quot;Follow-up suggested: system tradeoffs&quot;
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer hint */}
        <div className="mt-4 pt-3 border-t" style={{ borderColor: colors.cardBorder }}>
          <p className="text-xs text-center" style={{ color: colors.mutedText }}>
            AI copilots at every step
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// =============================================================================
// HERO SECTION
// =============================================================================

function HeroSection() {
  const trustItems = [
    { icon: Shield, text: "Security-first" },
    { icon: Clock, text: "Setup in 5 minutes" },
    { icon: CreditCard, text: "No credit card required" },
  ];

  return (
    <section className="relative min-h-[100svh] flex items-center pt-24 pb-16">
      <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-14 xl:px-16 w-full">
        <div className="grid lg:grid-cols-2 gap-12 xl:gap-16 items-center">
          {/* Left: Copy */}
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="text-center lg:text-left"
          >
            {/* Badge with hover glow */}
            <motion.div variants={staggerItem} className="mb-6">
              <motion.span
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium cursor-default"
                style={{
                  border: `1px solid ${colors.accentCyan}`,
                  background: "rgba(56, 189, 248, 0.1)",
                  color: colors.accentCyan,
                }}
                whileHover={{
                  boxShadow: `0 0 20px ${colors.accentCyanGlow}`,
                  borderColor: colors.accentCyan,
                }}
                transition={springs.soft}
              >
                <motion.div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: colors.accentCyan }}
                  animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <motion.span
                  whileHover={{ rotate: 10 }}
                  transition={springs.snappy}
                  className="inline-flex"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                </motion.span>
                AI RECRUITING PLATFORM
              </motion.span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={staggerItem}
              className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6"
              style={{ color: colors.titleText }}
            >
              One Platform.{" "}
              <span className="relative">
                Every Hire
                <span
                  className="absolute -bottom-2 left-0 right-0 h-1 rounded-full"
                  style={{
                    background: colors.accentCyan,
                    boxShadow: `0 0 20px ${colors.accentCyan}`,
                  }}
                />
              </span>
              .
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              variants={staggerItem}
              className="text-lg md:text-xl mb-8 max-w-lg mx-auto lg:mx-0"
              style={{ color: colors.subtitleText }}
            >
              From sourcing to signed offer — AI copilots that turn interviews into
              structured evidence and preserve context across every step.
            </motion.p>

            {/* CTA Row with juicy interactions */}
            <motion.div
              variants={staggerItem}
              className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-8"
            >
              {/* Primary CTA - Get Started */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={springs.snappy}
              >
                <Link
                  href="/auth?tab=signup"
                  className="group relative px-6 py-3 rounded-xl text-base font-semibold text-white flex items-center gap-2 overflow-hidden"
                  style={{
                    background: colors.primary,
                    boxShadow: colors.primaryGlow,
                  }}
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    initial={{ x: "-100%" }}
                    whileHover={{ x: "100%" }}
                    transition={{ duration: 0.5 }}
                  />
                  <span className="relative z-10">Get Started Free</span>
                  <motion.span
                    className="relative z-10"
                    initial={{ x: 0 }}
                    whileHover={{ x: 4 }}
                    transition={springs.snappy}
                  >
                    <ArrowRight className="w-4 h-4" />
                  </motion.span>
                </Link>
              </motion.div>

              {/* Secondary CTA - Watch Demo */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={springs.snappy}
              >
                <Link
                  href="#how-it-works"
                  className="group flex items-center gap-2 px-4 py-3 text-base font-medium"
                  style={{ color: colors.subtitleText }}
                >
                  <motion.span
                    whileHover={{ scale: 1.1, rotate: 10 }}
                    transition={springs.snappy}
                  >
                    <Play className="w-4 h-4" style={{ color: colors.primary }} />
                  </motion.span>
                  <span className="group-hover:text-white transition-colors">Watch Demo</span>
                  <motion.span
                    animate={{ x: [0, 4, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </motion.span>
                </Link>
              </motion.div>
            </motion.div>

            {/* Trust Row */}
            <motion.div
              variants={staggerItem}
              className="flex flex-wrap items-center justify-center lg:justify-start gap-6"
            >
              {trustItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <item.icon className="w-4 h-4" style={{ color: colors.accentCyan }} />
                  <span className="text-sm" style={{ color: colors.mutedText }}>
                    {item.text}
                  </span>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Right: Pipeline Preview with Tilt Effect */}
          <div className="relative lg:pl-8">
            <TiltCardWrapper tiltMaxAngle={5}>
              <PipelinePreviewCard />
            </TiltCardWrapper>
          </div>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// WHY SECTION
// =============================================================================

function WhySection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const cards = [
    {
      icon: Clock,
      title: "Reduce debrief time",
      description: "Evidence captured automatically means shorter meetings.",
    },
    {
      icon: Target,
      title: "Standardize evaluation",
      description: "Consistent rubrics and AI-assisted scoring.",
    },
    {
      icon: FileText,
      title: "Capture evidence automatically",
      description: "Every signal preserved, nothing lost between rounds.",
    },
  ];

  return (
    <section ref={ref} className="py-24 relative" style={{ background: "rgba(12, 17, 32, 0.85)" }}>
      <div className="max-w-[1440px] mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2
            className="text-3xl md:text-4xl font-bold mb-4"
            style={{ color: colors.titleText }}
          >
            Hiring breaks when context gets lost.
          </h2>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: colors.subtitleText }}>
            Hirely preserves context across every interview and turns it into
            evidence your team can trust.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {cards.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.1 }}
                className="group p-6 rounded-2xl cursor-pointer relative overflow-hidden"
                style={{
                  background: colors.cardBg,
                  border: `1px solid ${colors.cardBorder}`,
                }}
                whileHover={{
                  y: -4,
                  scale: 1.01,
                  borderColor: colors.cardBorderHover,
                  boxShadow: `0 20px 40px rgba(0, 0, 0, 0.3), 0 0 30px rgba(79, 124, 255, 0.15)`,
                }}
                whileTap={{ scale: 0.99 }}
              >
                {/* Hover highlight overlay */}
                <motion.div
                  className="absolute inset-0 rounded-2xl pointer-events-none"
                  style={{
                    background: `linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 50%)`,
                  }}
                  initial={{ opacity: 0 }}
                  whileHover={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                />
                <motion.div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 relative z-10"
                  style={{ background: `${colors.primary}20` }}
                  whileHover={{
                    background: `${colors.primary}30`,
                    boxShadow: `0 0 20px ${colors.primary}30`,
                  }}
                  transition={springs.soft}
                >
                  <Icon className="w-6 h-6 group-hover:scale-110 transition-transform" style={{ color: colors.primary }} />
                </motion.div>
                <h3 className="text-lg font-semibold mb-2 relative z-10" style={{ color: colors.titleText }}>
                  {card.title}
                </h3>
                <p className="text-sm relative z-10" style={{ color: colors.mutedText }}>
                  {card.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// METRICS SECTION
// =============================================================================

function MetricsSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const metrics = [
    { icon: TrendingUp, value: "3×", label: "Faster interviewer prep" },
    { icon: BarChart3, value: "35%", label: "Time saved per cycle" },
    { icon: Target, value: "More", label: "Consistent scoring" },
    { icon: Users, value: "Less", label: "Hiring bias" },
  ];

  return (
    <section ref={ref} className="py-16 relative" style={{ background: "transparent" }}>
      <div className="max-w-[1440px] mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {metrics.map((metric, i) => {
            const Icon = metric.icon;
            return (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="group p-5 rounded-2xl text-center cursor-pointer relative overflow-hidden"
                style={{
                  background: colors.cardBg,
                  border: `1px solid ${colors.cardBorder}`,
                }}
                whileHover={{
                  y: -4,
                  scale: 1.02,
                  borderColor: colors.cardBorderHover,
                  boxShadow: `0 15px 35px rgba(0, 0, 0, 0.25), 0 0 25px rgba(56, 189, 248, 0.1)`,
                }}
                whileTap={{ scale: 0.98 }}
              >
                {/* Hover overlay */}
                <motion.div
                  className="absolute inset-0 rounded-2xl pointer-events-none"
                  style={{
                    background: `linear-gradient(135deg, rgba(56, 189, 248, 0.05) 0%, transparent 60%)`,
                  }}
                  initial={{ opacity: 0 }}
                  whileHover={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                />
                <motion.div
                  className="relative z-10"
                  whileHover={{ scale: 1.1, y: -2 }}
                  transition={springs.soft}
                >
                  <Icon className="w-6 h-6 mx-auto mb-3" style={{ color: colors.accentCyan }} />
                </motion.div>
                <p
                  className="text-2xl md:text-3xl font-bold mb-1 relative z-10"
                  style={{ color: colors.titleText }}
                >
                  {metric.value}
                </p>
                <p className="text-xs relative z-10" style={{ color: colors.mutedText }}>
                  {metric.label}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// HOW IT WORKS SECTION
// =============================================================================

function HowItWorksSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      title: "Create & Enrich Job Profiles",
      description: "Paste a job description — Hirely extracts signals and builds a rubric.",
      icon: Briefcase,
      preview: "job-profile",
    },
    {
      title: "Source & Screen Candidates",
      description: "Rank candidates by fit. Surface hidden gems with AI-powered analysis.",
      icon: Search,
      preview: "screening",
    },
    {
      title: "Conduct AI-Powered Interviews",
      description: "Live copilot suggests follow-ups and tracks competency coverage.",
      icon: Video,
      preview: "interview",
    },
    {
      title: "Analyze & Decide With Confidence",
      description: "Evidence-linked scorecards, comparisons, and recommendations.",
      icon: PieChart,
      preview: "analysis",
    },
  ];

  return (
    <section
      ref={ref}
      id="how-it-works"
      className="py-24 relative"
      style={{ background: "rgba(12, 17, 32, 0.85)" }}
    >
      <div className="max-w-[1440px] mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2
            className="text-3xl md:text-4xl font-bold mb-4"
            style={{ color: colors.titleText }}
          >
            How It Works
          </h2>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: colors.subtitleText }}>
            Four simple steps from job posting to confident hiring decision.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left: Steps with hover lift */}
          <div className="space-y-4">
            {steps.map((step, i) => {
              const Icon = step.icon;
              const isActive = i === activeStep;

              return (
                <motion.button
                  key={step.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.1 + i * 0.1 }}
                  onClick={() => setActiveStep(i)}
                  className="w-full text-left p-5 rounded-2xl relative overflow-hidden"
                  style={{
                    background: isActive ? colors.cardBg : "transparent",
                    border: `1px solid ${isActive ? colors.primary + "40" : colors.cardBorder}`,
                    boxShadow: isActive ? `0 0 30px ${colors.primary}15` : "none",
                  }}
                  whileHover={{
                    y: -2,
                    borderColor: isActive ? `${colors.primary}60` : colors.cardBorderHover,
                    boxShadow: isActive
                      ? `0 10px 40px ${colors.primary}20`
                      : `0 8px 30px rgba(0, 0, 0, 0.2)`,
                  }}
                  whileTap={{ scale: 0.99 }}
                >
                  {/* Hover overlay */}
                  <motion.div
                    className="absolute inset-0 rounded-2xl pointer-events-none"
                    style={{
                      background: `linear-gradient(135deg, rgba(79, 124, 255, 0.03) 0%, transparent 50%)`,
                    }}
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  />
                  <div className="flex items-start gap-4 relative z-10">
                    <motion.div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: isActive ? colors.primary : "rgba(255,255,255,0.05)",
                      }}
                      whileHover={{
                        scale: 1.05,
                        boxShadow: isActive ? `0 0 20px ${colors.primary}50` : `0 0 15px rgba(255,255,255,0.1)`,
                      }}
                      transition={springs.snappy}
                    >
                      <Icon
                        className="w-5 h-5"
                        style={{ color: isActive ? "white" : colors.mutedText }}
                      />
                    </motion.div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <motion.span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{
                            background: isActive ? `${colors.primary}20` : "rgba(255,255,255,0.05)",
                            color: isActive ? colors.primary : colors.mutedText,
                          }}
                          whileHover={{
                            boxShadow: isActive ? `0 0 10px ${colors.primary}30` : "none",
                          }}
                        >
                          Step {i + 1}
                        </motion.span>
                      </div>
                      <h3
                        className="text-base font-semibold mb-1"
                        style={{ color: isActive ? colors.titleText : colors.subtitleText }}
                      >
                        {step.title}
                      </h3>
                      <p
                        className="text-sm"
                        style={{ color: isActive ? colors.subtitleText : colors.mutedText }}
                      >
                        {step.description}
                      </p>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Right: Preview */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="sticky top-32"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="rounded-2xl p-6 min-h-[300px]"
                style={{
                  background: colors.cardBg,
                  border: `1px solid ${colors.cardBorder}`,
                }}
              >
                <div className="flex items-center gap-3 mb-4">
                  {React.createElement(steps[activeStep].icon, {
                    className: "w-5 h-5",
                    style: { color: colors.primary },
                  })}
                  <span className="text-sm font-medium" style={{ color: colors.titleText }}>
                    {steps[activeStep].title}
                  </span>
                </div>
                <div
                  className="h-48 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.03)" }}
                >
                  <p className="text-sm" style={{ color: colors.mutedText }}>
                    Preview: {steps[activeStep].preview}
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// FEATURES SECTION
// =============================================================================

function FeaturesSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [activeTab, setActiveTab] = useState(0);

  const features = [
    {
      title: "In-Meeting Copilot",
      description:
        "Real-time follow-ups, red flag detection, talk ratio monitoring, and competency coverage tracking.",
      icon: Zap,
    },
    {
      title: "Unified Candidate Context",
      description:
        "Resume, interview signals, rubric scores, and evidence snippets—one profile that grows richer every round.",
      icon: Users,
    },
    {
      title: "Pipeline Analytics",
      description:
        "Visualize your hiring funnel, identify bottlenecks, and make data-driven decisions.",
      icon: BarChart3,
    },
    {
      title: "Continuous Learning",
      description:
        "The AI improves with every interview, learning your team's preferences and patterns.",
      icon: Brain,
    },
  ];

  return (
    <section ref={ref} id="features" className="py-24 relative" style={{ background: "transparent" }}>
      <div className="max-w-[1440px] mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2
            className="text-3xl md:text-4xl font-bold mb-4"
            style={{ color: colors.titleText }}
          >
            Features Built for Modern Teams
          </h2>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: colors.subtitleText }}>
            Everything you need to run evidence-driven interviews.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Feature Tabs with hover effects */}
          <div className="lg:col-span-2 space-y-3">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              const isActive = i === activeTab;

              return (
                <motion.button
                  key={feature.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.1 + i * 0.1 }}
                  onClick={() => setActiveTab(i)}
                  className="w-full text-left p-4 rounded-xl relative overflow-hidden"
                  style={{
                    background: isActive ? colors.cardBg : "transparent",
                    border: `1px solid ${isActive ? colors.cardBorder : "transparent"}`,
                  }}
                  whileHover={{
                    y: -2,
                    background: isActive ? colors.cardBg : "rgba(255,255,255,0.02)",
                    borderColor: isActive ? colors.cardBorderHover : colors.cardBorder,
                  }}
                  whileTap={{ scale: 0.99 }}
                >
                  {/* Hover overlay */}
                  <motion.div
                    className="absolute inset-0 rounded-xl pointer-events-none"
                    style={{
                      background: `linear-gradient(90deg, rgba(79, 124, 255, 0.05) 0%, transparent 50%)`,
                    }}
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  />
                  <div className="flex items-center gap-3 relative z-10">
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      transition={springs.snappy}
                    >
                      <Icon
                        className="w-5 h-5"
                        style={{ color: isActive ? colors.primary : colors.mutedText }}
                      />
                    </motion.div>
                    <span
                      className="font-medium"
                      style={{ color: isActive ? colors.titleText : colors.subtitleText }}
                    >
                      {feature.title}
                    </span>
                  </div>
                  {isActive && (
                    <motion.div
                      layoutId="activeFeature"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full"
                      style={{ background: colors.primary, boxShadow: `0 0 10px ${colors.primary}50` }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Feature Preview */}
          <div className="lg:col-span-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="rounded-2xl p-8 h-full"
                style={{
                  background: colors.cardBg,
                  border: `1px solid ${colors.cardBorder}`,
                }}
              >
                <div className="flex items-center gap-3 mb-4">
                  {React.createElement(features[activeTab].icon, {
                    className: "w-6 h-6",
                    style: { color: colors.primary },
                  })}
                  <h3 className="text-xl font-semibold" style={{ color: colors.titleText }}>
                    {features[activeTab].title}
                  </h3>
                </div>
                <p className="text-base mb-6" style={{ color: colors.subtitleText }}>
                  {features[activeTab].description}
                </p>
                <div
                  className="h-48 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.03)" }}
                >
                  <p className="text-sm" style={{ color: colors.mutedText }}>
                    Feature preview
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// FINAL CTA SECTION
// =============================================================================

function FinalCTASection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [isHovered, setIsHovered] = useState(false);

  return (
    <section ref={ref} className="py-24 relative overflow-hidden" style={{ background: "transparent" }}>
      {/* Background glow */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <motion.div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 60% 40% at 50% 50%, rgba(79, 124, 255, 0.15), transparent)`,
          }}
          animate={{
            opacity: isHovered ? 1.3 : 1,
            scale: isHovered ? 1.05 : 1,
          }}
          transition={{ duration: 0.4 }}
        />
      </div>

      <div className="max-w-4xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.5 }}
          className="rounded-3xl p-10 md:p-14 relative overflow-hidden"
          style={{
            background: colors.cardBg,
            border: `1px solid ${colors.cardBorder}`,
            boxShadow: "0 40px 100px rgba(0, 0, 0, 0.4)",
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          whileHover={{
            borderColor: colors.cardBorderHover,
            boxShadow: `0 40px 100px rgba(0, 0, 0, 0.5), 0 0 60px rgba(79, 124, 255, 0.15)`,
          }}
        >
          {/* Animated gradient overlay on hover */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(135deg, rgba(79, 124, 255, 0.05) 0%, transparent 40%, rgba(56, 189, 248, 0.03) 100%)`,
            }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.3 }}
          />
          <h2
            className="text-3xl md:text-4xl font-bold mb-4 relative z-10"
            style={{ color: colors.titleText }}
          >
            Stop Juggling Tools.{" "}
            <span style={{ color: colors.primary }}>Start Hiring Smarter.</span>
          </h2>
          <p className="text-lg mb-8 max-w-xl mx-auto relative z-10" style={{ color: colors.subtitleText }}>
            Everything you need to run evidence-driven interviews — in one place.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
            {/* Primary CTA with magnetic effect */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={springs.snappy}
            >
              <Link
                href="/auth?tab=signup"
                className="group relative px-8 py-4 rounded-xl text-base font-semibold text-white flex items-center gap-2 overflow-hidden"
                style={{
                  background: colors.primary,
                  boxShadow: colors.primaryGlow,
                }}
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  initial={{ x: "-100%" }}
                  whileHover={{ x: "100%" }}
                  transition={{ duration: 0.5 }}
                />
                <span className="relative z-10">Get Started Free</span>
                <motion.span
                  className="relative z-10"
                  initial={{ x: 0 }}
                  whileHover={{ x: 4 }}
                  transition={springs.snappy}
                >
                  <ArrowRight className="w-4 h-4" />
                </motion.span>
              </Link>
            </motion.div>

            {/* Secondary CTA */}
            <motion.div
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={springs.snappy}
            >
              <Link
                href="/demo"
                className="px-8 py-4 rounded-xl text-base font-medium block"
                style={{
                  border: `1px solid ${colors.cardBorder}`,
                  color: colors.subtitleText,
                }}
              >
                Schedule a Demo
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// =============================================================================
// FOOTER
// =============================================================================

// Animated footer link with underline
function AnimatedFooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Link
      href={href}
      className="relative text-sm py-0.5"
      style={{ color: isHovered ? colors.titleText : colors.mutedText }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      <motion.span
        className="absolute left-0 -bottom-0.5 h-px"
        style={{ background: colors.primary }}
        initial={{ width: 0 }}
        animate={{ width: isHovered ? "100%" : 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      />
    </Link>
  );
}

function Footer() {
  const links = {
    Product: ["Features", "Pricing", "Security", "Changelog"],
    Company: ["About", "Blog", "Careers", "Contact"],
    Legal: ["Privacy", "Terms", "Cookies"],
  };

  return (
    <footer
      className="py-16 border-t relative"
      style={{ background: "rgba(7, 10, 18, 0.9)", borderColor: colors.cardBorder }}
    >
      <div className="max-w-[1440px] mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-10 mb-12">
          {/* Logo with hover effect */}
          <div>
            <Link href="/" className="flex items-center gap-2.5 mb-4 group">
              <motion.div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: colors.primary }}
                whileHover={{ scale: 1.05, boxShadow: `0 0 20px ${colors.primary}50` }}
                transition={springs.snappy}
              >
                <Sparkles className="w-5 h-5 text-white" />
              </motion.div>
              <span className="text-lg font-semibold group-hover:text-white transition-colors" style={{ color: colors.titleText }}>
                Hirely
              </span>
            </Link>
            <p className="text-sm" style={{ color: colors.mutedText }}>
              AI-powered recruiting platform for modern teams.
            </p>
          </div>

          {/* Links with animated underlines */}
          {Object.entries(links).map(([category, items]) => (
            <div key={category}>
              <h4 className="text-sm font-semibold mb-4" style={{ color: colors.titleText }}>
                {category}
              </h4>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item}>
                    <AnimatedFooterLink href={`/${item.toLowerCase()}`}>
                      {item}
                    </AnimatedFooterLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-4"
          style={{ borderColor: colors.cardBorder }}
        >
          <p className="text-sm" style={{ color: colors.mutedText }}>
            © {new Date().getFullYear()} Hirely. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <AnimatedFooterLink href="/privacy">Privacy</AnimatedFooterLink>
            <AnimatedFooterLink href="/terms">Terms</AnimatedFooterLink>
          </div>
        </div>
      </div>
    </footer>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/jobs");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || isAuthenticated) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: colors.pageBg }}
      >
        <motion.div
          className="w-12 h-12 rounded-full border-2"
          style={{
            borderColor: colors.cardBorder,
            borderTopColor: colors.primary,
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </main>
    );
  }

  return (
    <main className="relative">
      {/* Starfield background with pulse rings */}
      <StarfieldBackground starCount={80} showPulseRings={true} />

      <GlassNavbar />
      <HeroSection />
      <WhySection />
      <MetricsSection />
      <HowItWorksSection />
      <FeaturesSection />
      <FinalCTASection />
      <Footer />

      {/* Noise texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-50 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </main>
  );
}
