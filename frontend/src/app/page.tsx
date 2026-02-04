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

// Import interactive demos
import { SourcingDemo, InterviewDemo, AnalyticsDemo } from "@/components/landing/InteractiveFeatureDemos";

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

// Spring configurations for smooth interactions (faster, snappier responses)
const springs = {
  stiff: { stiffness: 300, damping: 22 },      // Faster card lifts
  soft: { stiffness: 220, damping: 20 },       // Smoother but still responsive
  snappy: { stiffness: 450, damping: 25 },     // Very quick micro-interactions
  bounce: { stiffness: 350, damping: 18 },     // Slight bounce for CTAs
};

// Hover transition duration (150-220ms as per spec)
const hoverDuration = 0.15;

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

// Animated nav link with sliding underline - faster, more responsive
function AnimatedNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Link
      href={href}
      className="relative text-sm font-medium py-1"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <motion.span
        style={{ color: colors.mutedText }}
        animate={{
          color: isHovered ? colors.titleText : colors.mutedText,
          textShadow: isHovered ? `0 0 20px ${colors.primary}30` : "none",
        }}
        transition={{ duration: hoverDuration }}
      >
        {children}
      </motion.span>
      <motion.span
        className="absolute left-0 -bottom-0.5 h-px"
        style={{ background: `linear-gradient(90deg, ${colors.primary}, ${colors.accentCyan})` }}
        initial={{ width: 0, opacity: 0 }}
        animate={{
          width: isHovered ? "100%" : 0,
          opacity: isHovered ? 1 : 0,
          boxShadow: isHovered ? `0 0 8px ${colors.primary}60` : "none",
        }}
        transition={{ duration: hoverDuration, ease: "easeOut" }}
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
          background: scrolled || navHovered ? "rgba(12, 17, 32, 0.88)" : "rgba(12, 17, 32, 0.55)",
          backdropFilter: scrolled || navHovered ? "blur(28px)" : "blur(20px)",
          border: `1px solid ${colors.cardBorder}`,
        }}
        onMouseEnter={() => setNavHovered(true)}
        onMouseLeave={() => setNavHovered(false)}
        animate={{
          borderColor: navHovered ? colors.cardBorderHover : colors.cardBorder,
          boxShadow: scrolled
            ? "0 8px 32px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.05)"
            : navHovered
              ? "0 4px 20px rgba(0, 0, 0, 0.2)"
              : "none",
        }}
        transition={{ duration: hoverDuration }}
      >
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <motion.div
              className="w-9 h-9 rounded-xl flex items-center justify-center relative overflow-hidden"
              style={{ background: colors.primary }}
              whileHover={{
                scale: 1.08,
                boxShadow: `0 0 25px ${colors.primary}60, 0 0 50px ${colors.primary}30`,
              }}
              whileTap={{ scale: 0.95 }}
              transition={springs.bounce}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent"
                initial={{ x: "-100%", y: "-100%" }}
                whileHover={{ x: "100%", y: "100%" }}
                transition={{ duration: 0.4 }}
              />
              <Sparkles className="w-5 h-5 text-white relative z-10" />
            </motion.div>
            <motion.span
              className="text-lg font-semibold"
              style={{ color: colors.titleText }}
              whileHover={{ color: "#ffffff", textShadow: `0 0 15px ${colors.primary}40` }}
              transition={{ duration: hoverDuration }}
            >
              Hirely
            </motion.span>
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
              whileHover={{
                scale: 1.04,
                y: -2,
              }}
              whileTap={{ scale: 0.96 }}
              transition={springs.bounce}
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
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  initial={{ x: "-100%" }}
                  whileHover={{ x: "100%" }}
                  transition={{ duration: 0.35 }}
                />
                <motion.span
                  className="absolute inset-0 rounded-xl"
                  whileHover={{
                    boxShadow: `0 0 30px ${colors.primary}50, inset 0 0 20px rgba(255,255,255,0.1)`,
                  }}
                  transition={{ duration: hoverDuration }}
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
// TILT CARD WRAPPER (For Hero Preview) - Enhanced with more pronounced tilt
// =============================================================================

interface TiltCardWrapperProps {
  children: React.ReactNode;
  className?: string;
  tiltMaxAngle?: number;
  onHoverChange?: (isHovered: boolean) => void;
}

function TiltCardWrapper({ children, className = "", tiltMaxAngle = 10, onHoverChange }: TiltCardWrapperProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // More responsive spring for tilt
  const tiltSpring = { stiffness: 350, damping: 25 };
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [tiltMaxAngle, -tiltMaxAngle]), tiltSpring);
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-tiltMaxAngle, tiltMaxAngle]), tiltSpring);

  const glowX = useSpring(useTransform(x, [-0.5, 0.5], [0, 100]), tiltSpring);
  const glowY = useSpring(useTransform(y, [-0.5, 0.5], [0, 100]), tiltSpring);

  // Scale on hover
  const scale = useSpring(1, { stiffness: 300, damping: 22 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const normalizedX = (e.clientX - rect.left) / rect.width - 0.5;
    const normalizedY = (e.clientY - rect.top) / rect.height - 0.5;
    x.set(normalizedX);
    y.set(normalizedY);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    scale.set(1.02);
    onHoverChange?.(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    x.set(0);
    y.set(0);
    scale.set(1);
    onHoverChange?.(false);
  };

  return (
    <motion.div
      ref={ref}
      className={`relative ${className}`}
      style={{
        perspective: 1200,
        transformStyle: "preserve-3d",
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div
        style={{
          rotateX,
          rotateY,
          scale,
          transformStyle: "preserve-3d",
        }}
        className="relative"
      >
        {/* Glow that follows cursor - more intense */}
        <motion.div
          className="absolute inset-0 rounded-[20px] pointer-events-none z-10"
          style={{
            background: useTransform(
              [glowX, glowY],
              ([gx, gy]) =>
                `radial-gradient(circle at ${gx}% ${gy}%, rgba(79, 124, 255, 0.22), transparent 55%)`
            ),
            opacity: isHovered ? 1 : 0,
          }}
          transition={{ duration: hoverDuration }}
        />
        {/* Edge highlight on hover */}
        <motion.div
          className="absolute inset-0 rounded-[20px] pointer-events-none"
          animate={{
            boxShadow: isHovered
              ? `0 0 50px rgba(79, 124, 255, 0.25), inset 0 0 40px rgba(79, 124, 255, 0.08)`
              : "none",
          }}
          transition={{ duration: hoverDuration }}
        />
        {children}
      </motion.div>
    </motion.div>
  );
}

// =============================================================================
// PIPELINE PREVIEW CARD (Animated) - Enhanced with hover states & score tick-up
// =============================================================================

// Animated counter for score tick-up effect
function AnimatedScore({ value, delay = 0 }: { value: number; delay?: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (hasAnimated) return;
    const timer = setTimeout(() => {
      setHasAnimated(true);
      const duration = 800;
      const startTime = Date.now();
      const startValue = Math.max(0, value - 15); // Start from value - 15

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayValue(Math.round(startValue + (value - startValue) * eased));

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      animate();
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay, hasAnimated]);

  return <span>{displayValue}</span>;
}

function PipelinePreviewCard({ isParentHovered = false }: { isParentHovered?: boolean }) {
  const [activeStage, setActiveStage] = useState(3);
  const [showChip, setShowChip] = useState(false);
  const [hoveredCandidate, setHoveredCandidate] = useState<number | null>(null);

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

  // Animate pipeline progression - slower on parent hover (focus effect)
  useEffect(() => {
    const intervalDuration = isParentHovered ? 6000 : 4000; // Slow down on hover
    const interval = setInterval(() => {
      setActiveStage((prev) => (prev + 1) % stages.length);
      setShowChip(true);
      setTimeout(() => setShowChip(false), 2000);
    }, intervalDuration);
    return () => clearInterval(interval);
  }, [stages.length, isParentHovered]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 25, delay: 0.4 }}
      className="relative"
    >
      {/* Floating animation - slower on parent hover */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{
          duration: isParentHovered ? 6 : 4, // Slower float on hover
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="rounded-[20px] p-6 relative overflow-hidden"
        style={{
          background: colors.cardBg,
          border: `1px solid ${colors.cardBorder}`,
          boxShadow: "0 30px 90px rgba(0, 0, 0, 0.45)",
        }}
      >
        {/* Inner highlight - enhanced on parent hover */}
        <motion.div
          className="absolute top-0 left-4 right-4 h-px"
          animate={{
            opacity: isParentHovered ? 1 : 0.6,
          }}
          style={{
            background: `linear-gradient(90deg, transparent, rgba(255,255,255,${isParentHovered ? 0.2 : 0.1}), transparent)`,
          }}
          transition={{ duration: hoverDuration }}
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <motion.span
              className="px-3 py-1 rounded-full text-xs font-medium"
              style={{ background: "rgba(79, 124, 255, 0.15)", color: colors.primary }}
              whileHover={{ scale: 1.05, boxShadow: `0 0 15px ${colors.primary}30` }}
              transition={{ duration: hoverDuration }}
            >
              Role: Founding Engineer
            </motion.span>
            <motion.span
              className="px-3 py-1 rounded-full text-xs font-medium"
              style={{ background: "rgba(56, 189, 248, 0.15)", color: colors.accentCyan }}
              animate={{ boxShadow: isParentHovered ? `0 0 12px ${colors.accentCyan}25` : "none" }}
              transition={{ duration: hoverDuration }}
            >
              Stage: {stages[activeStage].name}
            </motion.span>
          </div>
          <motion.div
            className="flex items-center gap-1.5"
            animate={{ scale: isParentHovered ? 1.05 : 1 }}
            transition={{ duration: hoverDuration }}
          >
            <motion.div
              className="w-2 h-2 rounded-full"
              style={{ background: colors.accentAmber }}
              animate={{
                scale: [1, 1.3, 1],
                opacity: [1, 0.7, 1],
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className="text-xs font-medium" style={{ color: colors.accentAmber }}>
              LIVE
            </span>
          </motion.div>
        </div>

        {/* Pipeline Stages - with individual hover states */}
        <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-2">
          {stages.map((stage, i) => {
            const Icon = stage.icon;
            const isActive = i === activeStage;
            const isPast = i < activeStage;

            return (
              <div key={stage.name} className="flex items-center">
                <motion.div
                  className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer"
                  animate={{
                    background: isActive ? "rgba(79, 124, 255, 0.15)" : "transparent",
                    scale: isActive ? 1.05 : 1,
                  }}
                  whileHover={{
                    scale: 1.08,
                    background: isActive ? "rgba(79, 124, 255, 0.2)" : "rgba(255, 255, 255, 0.05)",
                  }}
                  transition={{ duration: hoverDuration }}
                >
                  <motion.div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      background: isActive
                        ? colors.primary
                        : isPast
                          ? "rgba(34, 197, 94, 0.2)"
                          : "rgba(255, 255, 255, 0.05)",
                      boxShadow: isActive ? `0 0 20px ${colors.primary}40` : "none",
                    }}
                    whileHover={{
                      scale: 1.1,
                      boxShadow: isActive
                        ? `0 0 30px ${colors.primary}60`
                        : isPast
                          ? `0 0 15px ${colors.accentGreen}30`
                          : `0 0 12px rgba(255, 255, 255, 0.1)`,
                    }}
                    transition={springs.bounce}
                  >
                    {isPast ? (
                      <Check className="w-4 h-4" style={{ color: colors.accentGreen }} />
                    ) : (
                      <Icon
                        className="w-4 h-4"
                        style={{ color: isActive ? "white" : colors.mutedText }}
                      />
                    )}
                  </motion.div>
                  <span
                    className="text-[10px] font-medium whitespace-nowrap"
                    style={{ color: isActive ? colors.titleText : colors.mutedText }}
                  >
                    {stage.name}
                  </span>
                </motion.div>
                {i < stages.length - 1 && (
                  <motion.div
                    className="w-4 h-0.5 mx-1 rounded-full"
                    style={{
                      background: isPast
                        ? colors.accentGreen
                        : i === activeStage
                          ? `linear-gradient(90deg, ${colors.primary}, ${colors.mutedText}40)`
                          : "rgba(255, 255, 255, 0.1)",
                    }}
                    animate={{
                      scaleX: isPast || i === activeStage ? 1 : 0.8,
                    }}
                    transition={{ duration: 0.3 }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Candidate Cards - with individual hover states */}
        <div className="space-y-2">
          {candidates.map((candidate, i) => (
            <motion.div
              key={candidate.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + i * 0.1 }}
              className="flex items-center justify-between p-3 rounded-xl cursor-pointer"
              style={{ background: "rgba(255, 255, 255, 0.03)" }}
              onMouseEnter={() => setHoveredCandidate(i)}
              onMouseLeave={() => setHoveredCandidate(null)}
              whileHover={{
                background: "rgba(255, 255, 255, 0.06)",
                y: -2,
                scale: 1.01,
                boxShadow: `0 8px 25px rgba(0, 0, 0, 0.2), 0 0 20px ${candidate.signalColor}15`,
              }}
              whileTap={{ scale: 0.99 }}
            >
              <div className="flex items-center gap-3">
                <motion.div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
                  style={{ background: "rgba(79, 124, 255, 0.2)", color: colors.primary }}
                  animate={{
                    scale: hoveredCandidate === i ? 1.1 : 1,
                    boxShadow: hoveredCandidate === i ? `0 0 15px ${colors.primary}40` : "none",
                  }}
                  transition={springs.bounce}
                >
                  {candidate.name.charAt(0)}
                </motion.div>
                <div>
                  <motion.p
                    className="text-sm font-medium"
                    style={{ color: colors.titleText }}
                    animate={{
                      color: hoveredCandidate === i ? "#ffffff" : colors.titleText,
                    }}
                    transition={{ duration: hoverDuration }}
                  >
                    {candidate.name}
                  </motion.p>
                  <p className="text-xs" style={{ color: colors.mutedText }}>
                    Fit Score:{" "}
                    <motion.span
                      style={{ fontFamily: "JetBrains Mono, monospace", color: colors.accentCyan }}
                      animate={{
                        textShadow: hoveredCandidate === i ? `0 0 10px ${colors.accentCyan}50` : "none",
                      }}
                    >
                      <AnimatedScore value={candidate.score} delay={600 + i * 100} />
                    </motion.span>
                  </p>
                </div>
              </div>
              <motion.span
                className="px-2 py-1 rounded-md text-xs font-medium"
                style={{
                  background: `${candidate.signalColor}15`,
                  color: candidate.signalColor,
                }}
                animate={{
                  scale: hoveredCandidate === i ? 1.05 : 1,
                  boxShadow: hoveredCandidate === i ? `0 0 12px ${candidate.signalColor}30` : "none",
                }}
                transition={{ duration: hoverDuration }}
              >
                {candidate.signal}
              </motion.span>
            </motion.div>
          ))}
        </div>

        {/* AI Chip Animation - enhanced */}
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
              whileHover={{
                scale: 1.05,
                boxShadow: `0 0 20px ${colors.accentCyan}30`,
              }}
            >
              <motion.span
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <Zap className="w-3 h-3" />
              </motion.span>
              AI: &quot;Follow-up suggested: system tradeoffs&quot;
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer hint */}
        <div className="mt-4 pt-3 border-t" style={{ borderColor: colors.cardBorder }}>
          <motion.p
            className="text-xs text-center"
            style={{ color: colors.mutedText }}
            animate={{
              color: isParentHovered ? colors.subtitleText : colors.mutedText,
            }}
            transition={{ duration: hoverDuration }}
          >
            AI copilots at every step
          </motion.p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// =============================================================================
// HERO SECTION
// =============================================================================

function HeroSection() {
  const [isPipelineHovered, setIsPipelineHovered] = useState(false);

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
            {/* Badge with hover glow - enhanced */}
            <motion.div variants={staggerItem} className="mb-6">
              <motion.span
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium cursor-default"
                style={{
                  border: `1px solid ${colors.accentCyan}`,
                  background: "rgba(56, 189, 248, 0.1)",
                  color: colors.accentCyan,
                }}
                whileHover={{
                  boxShadow: `0 0 30px ${colors.accentCyanGlow}, 0 0 60px rgba(56, 189, 248, 0.2)`,
                  borderColor: colors.accentCyan,
                  scale: 1.02,
                }}
                transition={springs.stiff}
              >
                <motion.div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: colors.accentCyan }}
                  animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                />
                <motion.span
                  whileHover={{ rotate: 12, scale: 1.1 }}
                  transition={springs.bounce}
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
                whileHover={{ scale: 1.04, y: -3 }}
                whileTap={{ scale: 0.96 }}
                transition={springs.bounce}
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
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                    initial={{ x: "-100%" }}
                    whileHover={{ x: "100%" }}
                    transition={{ duration: 0.35 }}
                  />
                  <motion.div
                    className="absolute inset-0 rounded-xl"
                    whileHover={{
                      boxShadow: `0 0 40px ${colors.primary}60, 0 15px 50px ${colors.primary}35`,
                    }}
                    transition={{ duration: hoverDuration }}
                  />
                  <span className="relative z-10">Get Started Free</span>
                  <motion.span
                    className="relative z-10"
                    initial={{ x: 0 }}
                    whileHover={{ x: 6 }}
                    transition={springs.snappy}
                  >
                    <ArrowRight className="w-4 h-4" />
                  </motion.span>
                </Link>
              </motion.div>

              {/* Secondary CTA - Watch Demo */}
              <motion.div
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={springs.stiff}
              >
                <Link
                  href="#how-it-works"
                  className="group flex items-center gap-2 px-4 py-3 text-base font-medium relative"
                  style={{ color: colors.subtitleText }}
                >
                  <motion.span
                    whileHover={{
                      scale: 1.15,
                      rotate: 15,
                      boxShadow: `0 0 15px ${colors.primary}50`,
                    }}
                    transition={springs.bounce}
                    className="rounded-full"
                  >
                    <Play className="w-4 h-4" style={{ color: colors.primary }} />
                  </motion.span>
                  <motion.span
                    initial={{ color: colors.subtitleText }}
                    whileHover={{ color: "#ffffff" }}
                    transition={{ duration: hoverDuration }}
                  >
                    Watch Demo
                  </motion.span>
                  <motion.span
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
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
            <TiltCardWrapper tiltMaxAngle={8} onHoverChange={setIsPipelineHovered}>
              <PipelinePreviewCard isParentHovered={isPipelineHovered} />
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
                className="group p-6 rounded-2xl cursor-pointer relative overflow-hidden"
                style={{
                  background: colors.cardBg,
                  border: `1px solid ${colors.cardBorder}`,
                }}
                whileHover={{
                  y: -6,
                  scale: 1.02,
                  borderColor: colors.cardBorderHover,
                  boxShadow: `0 25px 50px rgba(0, 0, 0, 0.35), 0 0 40px rgba(79, 124, 255, 0.18)`,
                  transition: springs.stiff,
                }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
              >
                {/* Hover highlight overlay with gradient */}
                <motion.div
                  className="absolute inset-0 rounded-2xl pointer-events-none"
                  initial={{ opacity: 0 }}
                  whileHover={{ opacity: 1 }}
                  transition={{ duration: hoverDuration }}
                  style={{
                    background: `linear-gradient(135deg, rgba(79, 124, 255, 0.08) 0%, transparent 50%, rgba(56, 189, 248, 0.04) 100%)`,
                  }}
                />
                {/* Top border glow on hover */}
                <motion.div
                  className="absolute top-0 left-4 right-4 h-px pointer-events-none"
                  initial={{ opacity: 0 }}
                  whileHover={{ opacity: 1 }}
                  transition={{ duration: hoverDuration }}
                  style={{
                    background: `linear-gradient(90deg, transparent, ${colors.primary}60, transparent)`,
                  }}
                />
                <motion.div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 relative z-10"
                  style={{ background: `${colors.primary}20` }}
                  whileHover={{
                    background: `${colors.primary}35`,
                    boxShadow: `0 0 25px ${colors.primary}40`,
                    scale: 1.08,
                  }}
                  transition={springs.bounce}
                >
                  <Icon className="w-6 h-6" style={{ color: colors.primary }} />
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
                className="group p-5 rounded-2xl text-center cursor-pointer relative overflow-hidden"
                style={{
                  background: colors.cardBg,
                  border: `1px solid ${colors.cardBorder}`,
                }}
                whileHover={{
                  y: -5,
                  scale: 1.03,
                  borderColor: colors.cardBorderHover,
                  boxShadow: `0 20px 40px rgba(0, 0, 0, 0.3), 0 0 30px rgba(56, 189, 248, 0.15)`,
                  transition: springs.stiff,
                }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.35, delay: i * 0.08 }}
              >
                {/* Hover overlay with cyan tint */}
                <motion.div
                  className="absolute inset-0 rounded-2xl pointer-events-none"
                  initial={{ opacity: 0 }}
                  whileHover={{ opacity: 1 }}
                  transition={{ duration: hoverDuration }}
                  style={{
                    background: `linear-gradient(135deg, rgba(56, 189, 248, 0.08) 0%, transparent 60%)`,
                  }}
                />
                {/* Top highlight */}
                <motion.div
                  className="absolute top-0 left-3 right-3 h-px pointer-events-none"
                  initial={{ opacity: 0 }}
                  whileHover={{ opacity: 1 }}
                  transition={{ duration: hoverDuration }}
                  style={{
                    background: `linear-gradient(90deg, transparent, ${colors.accentCyan}50, transparent)`,
                  }}
                />
                <motion.div
                  className="relative z-10"
                  whileHover={{
                    scale: 1.15,
                    y: -3,
                    filter: `drop-shadow(0 0 12px ${colors.accentCyan}60)`,
                  }}
                  transition={springs.bounce}
                >
                  <Icon className="w-6 h-6 mx-auto mb-3" style={{ color: colors.accentCyan }} />
                </motion.div>
                <motion.p
                  className="text-2xl md:text-3xl font-bold mb-1 relative z-10"
                  style={{ color: colors.titleText }}
                  whileHover={{ textShadow: `0 0 20px ${colors.accentCyan}40` }}
                  transition={{ duration: hoverDuration }}
                >
                  {metric.value}
                </motion.p>
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
                  onClick={() => setActiveStep(i)}
                  className="w-full text-left p-5 rounded-2xl relative overflow-hidden"
                  style={{
                    background: isActive ? colors.cardBg : "transparent",
                    border: `1px solid ${isActive ? colors.primary + "40" : colors.cardBorder}`,
                    boxShadow: isActive ? `0 0 35px ${colors.primary}18` : "none",
                  }}
                  whileHover={{
                    y: -4,
                    scale: 1.01,
                    borderColor: isActive ? `${colors.primary}70` : colors.cardBorderHover,
                    boxShadow: isActive
                      ? `0 15px 45px ${colors.primary}25`
                      : `0 12px 35px rgba(0, 0, 0, 0.25)`,
                    transition: springs.stiff,
                  }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.35, delay: 0.1 + i * 0.08 }}
                >
                  {/* Hover overlay with gradient */}
                  <motion.div
                    className="absolute inset-0 rounded-2xl pointer-events-none"
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 1 }}
                    transition={{ duration: hoverDuration }}
                    style={{
                      background: isActive
                        ? `linear-gradient(135deg, rgba(79, 124, 255, 0.08) 0%, transparent 60%)`
                        : `linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, transparent 50%)`,
                    }}
                  />
                  {/* Top border highlight on active */}
                  {isActive && (
                    <motion.div
                      className="absolute top-0 left-4 right-4 h-px pointer-events-none"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{
                        background: `linear-gradient(90deg, transparent, ${colors.primary}50, transparent)`,
                      }}
                    />
                  )}
                  <div className="flex items-start gap-4 relative z-10">
                    <motion.div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: isActive ? colors.primary : "rgba(255,255,255,0.05)",
                      }}
                      whileHover={{
                        scale: 1.1,
                        boxShadow: isActive
                          ? `0 0 25px ${colors.primary}60`
                          : `0 0 18px rgba(255,255,255,0.12)`,
                      }}
                      transition={springs.bounce}
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
                            boxShadow: isActive ? `0 0 12px ${colors.primary}35` : "none",
                            scale: 1.05,
                          }}
                          transition={{ duration: hoverDuration }}
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
                className="rounded-2xl p-6 min-h-[300px] border border-white/5 bg-slate-900/50 backdrop-blur-sm"
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
                  className="h-64 rounded-xl flex items-center justify-center relative overflow-hidden"
                  style={{ background: "rgba(15, 23, 42, 0.6)" }}
                >
                  {/* Render the appropriate demo based on activeStep */}
                  {activeStep === 0 && (
                    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                      <Briefcase className="w-12 h-12 mb-4 opacity-20" style={{ color: colors.primary }} />
                      <p className="text-sm font-medium" style={{ color: colors.subtitleText }}>Job Profile Enrichment</p>
                      <p className="text-xs mt-2 max-w-xs" style={{ color: colors.mutedText }}>
                        AI automatically extracts skills and criteria from your job description.
                      </p>
                    </div>
                  )}
                  {activeStep === 1 && <SourcingDemo />}
                  {activeStep === 2 && <InterviewDemo />}
                  {activeStep === 3 && <AnalyticsDemo />}
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
                  onClick={() => setActiveTab(i)}
                  className="w-full text-left p-4 rounded-xl relative overflow-hidden"
                  style={{
                    background: isActive ? colors.cardBg : "transparent",
                    border: `1px solid ${isActive ? colors.cardBorder : "transparent"}`,
                  }}
                  whileHover={{
                    y: -3,
                    scale: 1.01,
                    background: isActive ? colors.cardBg : "rgba(255,255,255,0.03)",
                    borderColor: isActive ? colors.cardBorderHover : colors.cardBorder,
                    boxShadow: isActive
                      ? `0 10px 30px rgba(0, 0, 0, 0.2)`
                      : `0 8px 25px rgba(0, 0, 0, 0.15)`,
                    transition: springs.stiff,
                  }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.35, delay: 0.1 + i * 0.08 }}
                >
                  {/* Hover overlay with gradient */}
                  <motion.div
                    className="absolute inset-0 rounded-xl pointer-events-none"
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 1 }}
                    transition={{ duration: hoverDuration }}
                    style={{
                      background: `linear-gradient(90deg, rgba(79, 124, 255, 0.08) 0%, transparent 60%)`,
                    }}
                  />
                  <div className="flex items-center gap-3 relative z-10">
                    <motion.div
                      whileHover={{
                        scale: 1.15,
                        filter: `drop-shadow(0 0 8px ${colors.primary}50)`,
                      }}
                      transition={springs.bounce}
                    >
                      <Icon
                        className="w-5 h-5"
                        style={{ color: isActive ? colors.primary : colors.mutedText }}
                      />
                    </motion.div>
                    <motion.span
                      className="font-medium"
                      style={{ color: isActive ? colors.titleText : colors.subtitleText }}
                      whileHover={{
                        color: colors.titleText,
                        textShadow: isActive ? `0 0 15px ${colors.primary}30` : "none",
                      }}
                      transition={{ duration: hoverDuration }}
                    >
                      {feature.title}
                    </motion.span>
                    {/* Learn more indicator on hover */}
                    <motion.span
                      className="ml-auto text-xs flex items-center gap-1"
                      style={{ color: colors.primary }}
                      initial={{ opacity: 0, x: -10 }}
                      whileHover={{ opacity: 1, x: 0 }}
                      transition={{ duration: hoverDuration }}
                    >
                      Learn more <ArrowRight className="w-3 h-3" />
                    </motion.span>
                  </div>
                  {isActive && (
                    <motion.div
                      layoutId="activeFeature"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full"
                      style={{ background: colors.primary, boxShadow: `0 0 15px ${colors.primary}60` }}
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
      {/* Background glow - more dynamic */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <motion.div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 60% 40% at 50% 50%, rgba(79, 124, 255, 0.15), transparent)`,
          }}
          animate={{
            opacity: isHovered ? 1.4 : 1,
            scale: isHovered ? 1.08 : 1,
          }}
          transition={{ duration: 0.25 }}
        />
      </div>

      <div className="max-w-4xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
          className="rounded-3xl p-10 md:p-14 relative overflow-hidden"
          style={{
            background: colors.cardBg,
            border: `1px solid ${colors.cardBorder}`,
            boxShadow: "0 40px 100px rgba(0, 0, 0, 0.4)",
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          whileHover={{
            scale: 1.01,
            borderColor: colors.cardBorderHover,
            boxShadow: `0 45px 110px rgba(0, 0, 0, 0.5), 0 0 80px rgba(79, 124, 255, 0.2)`,
            transition: springs.soft,
          }}
          transition={{ duration: 0.5 }}
        >
          {/* Animated gradient overlay on hover - faster */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(135deg, rgba(79, 124, 255, 0.08) 0%, transparent 40%, rgba(56, 189, 248, 0.05) 100%)`,
            }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: hoverDuration }}
          />
          {/* Top highlight */}
          <motion.div
            className="absolute top-0 left-8 right-8 h-px pointer-events-none"
            animate={{ opacity: isHovered ? 1 : 0.5 }}
            transition={{ duration: hoverDuration }}
            style={{
              background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)`,
            }}
          />
          <h2
            className="text-3xl md:text-4xl font-bold mb-4 relative z-10"
            style={{ color: colors.titleText }}
          >
            Stop Juggling Tools.{" "}
            <motion.span
              style={{ color: colors.primary }}
              animate={{ textShadow: isHovered ? `0 0 30px ${colors.primary}50` : "none" }}
              transition={{ duration: hoverDuration }}
            >
              Start Hiring Smarter.
            </motion.span>
          </h2>
          <p className="text-lg mb-8 max-w-xl mx-auto relative z-10" style={{ color: colors.subtitleText }}>
            Everything you need to run evidence-driven interviews — in one place.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
            {/* Primary CTA - strongest glow on the page */}
            <motion.div
              whileHover={{ scale: 1.05, y: -4 }}
              whileTap={{ scale: 0.95 }}
              transition={springs.bounce}
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
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  initial={{ x: "-100%" }}
                  whileHover={{ x: "100%" }}
                  transition={{ duration: 0.35 }}
                />
                <motion.div
                  className="absolute inset-0 rounded-xl"
                  whileHover={{
                    boxShadow: `0 0 50px ${colors.primary}70, 0 20px 60px ${colors.primary}40`,
                  }}
                  transition={{ duration: hoverDuration }}
                />
                <span className="relative z-10">Get Started Free</span>
                <motion.span
                  className="relative z-10"
                  initial={{ x: 0 }}
                  whileHover={{ x: 6 }}
                  transition={springs.snappy}
                >
                  <ArrowRight className="w-4 h-4" />
                </motion.span>
              </Link>
            </motion.div>

            {/* Secondary CTA - enhanced hover */}
            <motion.div
              whileHover={{
                scale: 1.04,
                y: -3,
                boxShadow: `0 15px 40px rgba(0, 0, 0, 0.25)`,
              }}
              whileTap={{ scale: 0.96 }}
              transition={springs.stiff}
            >
              <Link
                href="/demo"
                className="px-8 py-4 rounded-xl text-base font-medium block relative overflow-hidden"
                style={{
                  border: `1px solid ${colors.cardBorder}`,
                  color: colors.subtitleText,
                }}
              >
                <motion.div
                  className="absolute inset-0 rounded-xl pointer-events-none"
                  initial={{ opacity: 0 }}
                  whileHover={{
                    opacity: 1,
                    borderColor: colors.cardBorderHover,
                  }}
                  transition={{ duration: hoverDuration }}
                  style={{
                    background: `linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, transparent 50%)`,
                  }}
                />
                <span className="relative z-10">Schedule a Demo</span>
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

// Animated footer link with underline - faster
function AnimatedFooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Link
      href={href}
      className="relative text-sm py-0.5"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <motion.span
        animate={{
          color: isHovered ? colors.titleText : colors.mutedText,
        }}
        transition={{ duration: hoverDuration }}
      >
        {children}
      </motion.span>
      <motion.span
        className="absolute left-0 -bottom-0.5 h-px"
        style={{ background: `linear-gradient(90deg, ${colors.primary}, ${colors.accentCyan})` }}
        initial={{ width: 0, opacity: 0 }}
        animate={{
          width: isHovered ? "100%" : 0,
          opacity: isHovered ? 1 : 0,
        }}
        transition={{ duration: hoverDuration, ease: "easeOut" }}
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
                className="w-9 h-9 rounded-xl flex items-center justify-center relative overflow-hidden"
                style={{ background: colors.primary }}
                whileHover={{
                  scale: 1.08,
                  boxShadow: `0 0 25px ${colors.primary}60`,
                }}
                whileTap={{ scale: 0.95 }}
                transition={springs.bounce}
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent"
                  initial={{ x: "-100%", y: "-100%" }}
                  whileHover={{ x: "100%", y: "100%" }}
                  transition={{ duration: 0.35 }}
                />
                <Sparkles className="w-5 h-5 text-white relative z-10" />
              </motion.div>
              <motion.span
                className="text-lg font-semibold"
                style={{ color: colors.titleText }}
                whileHover={{ color: "#ffffff" }}
                transition={{ duration: hoverDuration }}
              >
                Hirely
              </motion.span>
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
