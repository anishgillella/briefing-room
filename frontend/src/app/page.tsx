"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  useSpring,
  useMotionValue,
  AnimatePresence,
} from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import {
  Users,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Zap,
  Target,
  TrendingUp,
  Play,
  BarChart3,
  Brain,
  MessageSquare,
  Shield,
  FileText,
  Video,
  PieChart,
  Workflow,
  Clock,
  Award,
  ChevronRight,
} from "lucide-react";

// Dynamically import Three.js component
const HeroScene = dynamic(() => import("@/components/three/HeroScene"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-50 via-teal-50/30 to-orange-50/20" />
  ),
});

// =============================================================================
// SCROLL PROGRESS
// =============================================================================

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-orange-500 to-teal-500 origin-left z-[100]"
      style={{ scaleX }}
    />
  );
}

// =============================================================================
// MAGNETIC BUTTON
// =============================================================================

function MagneticButton({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set((e.clientX - centerX) * 0.2);
    y.set((e.clientY - centerY) * 0.2);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x, y }}
      transition={{ type: "spring", stiffness: 150, damping: 15 }}
    >
      {children}
    </motion.div>
  );
}

// =============================================================================
// ANIMATED COUNTER
// =============================================================================

function AnimatedCounter({
  value,
  suffix = "",
}: {
  value: number;
  suffix?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const springValue = useSpring(0, { duration: 2000 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (isInView) {
      springValue.set(value);
    }
  }, [isInView, value, springValue]);

  useEffect(() => {
    const unsubscribe = springValue.on("change", (v) => setDisplay(Math.round(v)));
    return unsubscribe;
  }, [springValue]);

  return (
    <span ref={ref}>
      {display}
      {suffix}
    </span>
  );
}

// =============================================================================
// 3D TILT CARD
// =============================================================================

function TiltCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useTransform(y, [-0.5, 0.5], [8, -8]);
  const rotateY = useTransform(x, [-0.5, 0.5], [-8, 8]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
        perspective: 1000,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {children}
    </motion.div>
  );
}

// =============================================================================
// INFINITE MARQUEE
// =============================================================================

function Marquee({ children, speed = 30 }: { children: React.ReactNode; speed?: number }) {
  return (
    <div className="overflow-hidden whitespace-nowrap">
      <motion.div
        className="inline-flex"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: speed, repeat: Infinity, ease: "linear" }}
      >
        {children}
        {children}
      </motion.div>
    </div>
  );
}

// =============================================================================
// GLOWING ORB BACKGROUND
// =============================================================================

function GlowingOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-400/20 rounded-full blur-3xl"
        animate={{
          scale: [1, 1.2, 1],
          x: [0, 50, 0],
          y: [0, 30, 0],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-orange-400/20 rounded-full blur-3xl"
        animate={{
          scale: [1.2, 1, 1.2],
          x: [0, -30, 0],
          y: [0, -50, 0],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/2 right-1/3 w-64 h-64 bg-violet-400/10 rounded-full blur-3xl"
        animate={{
          scale: [1, 1.3, 1],
          rotate: [0, 180, 360],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

// =============================================================================
// FEATURE PIPELINE VISUALIZATION
// =============================================================================

function PipelineVisualization() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const stages = [
    { icon: FileText, label: "Job Creation", color: "bg-teal-500" },
    { icon: Users, label: "Sourcing", color: "bg-teal-500" },
    { icon: Video, label: "AI Interview", color: "bg-orange-500" },
    { icon: Brain, label: "Analysis", color: "bg-violet-500" },
    { icon: Award, label: "Hire", color: "bg-emerald-500" },
  ];

  return (
    <div ref={ref} className="relative py-8">
      {/* Connection line */}
      <motion.div
        className="absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-orange-500 to-emerald-500 -translate-y-1/2"
        initial={{ scaleX: 0 }}
        animate={isInView ? { scaleX: 1 } : {}}
        transition={{ duration: 1.5, ease: "easeOut" }}
        style={{ originX: 0 }}
      />

      <div className="flex justify-between relative z-10">
        {stages.map((stage, i) => (
          <motion.div
            key={i}
            className="flex flex-col items-center"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: i * 0.2 }}
          >
            <motion.div
              className={`w-16 h-16 ${stage.color} rounded-2xl flex items-center justify-center shadow-lg mb-3`}
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <stage.icon className="w-8 h-8 text-white" />
            </motion.div>
            <span className="text-sm font-medium text-slate-700">{stage.label}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// BENTO CARD
// =============================================================================

interface BentoCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  className?: string;
  gradient?: string;
  iconBg?: string;
  delay?: number;
  size?: "sm" | "md" | "lg";
}

function BentoCard({
  icon: Icon,
  title,
  description,
  className = "",
  gradient = "from-slate-50 to-white",
  iconBg = "bg-teal-500",
  delay = 0,
  size = "md",
}: BentoCardProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      <TiltCard className="h-full">
        <div
          className={`group relative h-full bg-gradient-to-br ${gradient} rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-500 overflow-hidden`}
          style={{ padding: size === "lg" ? "2.5rem" : size === "sm" ? "1.5rem" : "2rem" }}
        >
          {/* Glassmorphism overlay on hover */}
          <div className="absolute inset-0 bg-white/40 opacity-0 group-hover:opacity-100 backdrop-blur-sm transition-all duration-500 rounded-3xl" />

          {/* Animated border gradient */}
          <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500">
            <div className="absolute inset-[-1px] rounded-3xl bg-gradient-to-r from-teal-500 via-orange-500 to-violet-500 animate-gradient" style={{ padding: "1px" }}>
              <div className="w-full h-full bg-white rounded-3xl" />
            </div>
          </div>

          {/* Content */}
          <div className="relative z-10">
            <motion.div
              className={`${size === "lg" ? "w-16 h-16" : "w-12 h-12"} ${iconBg} rounded-2xl flex items-center justify-center mb-5 shadow-lg`}
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Icon className={`${size === "lg" ? "w-8 h-8" : "w-6 h-6"} text-white`} />
            </motion.div>

            <h3 className={`${size === "lg" ? "text-2xl" : "text-xl"} font-bold text-slate-900 mb-3`}>
              {title}
            </h3>
            <p className="text-slate-600 leading-relaxed">{description}</p>
          </div>

          {/* Decorative glow */}
          <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full bg-gradient-to-br from-slate-100/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>
      </TiltCard>
    </motion.div>
  );
}

// =============================================================================
// STAT CARD
// =============================================================================

function StatCard({
  value,
  suffix,
  label,
  delay,
}: {
  value: number;
  suffix: string;
  label: string;
  delay: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className="group"
    >
      <div className="text-center p-6 rounded-2xl bg-white/50 backdrop-blur-sm border border-slate-200/50 hover:bg-white hover:shadow-xl transition-all duration-300">
        <motion.div
          className="text-5xl md:text-6xl font-bold text-gradient mb-2"
          whileHover={{ scale: 1.05 }}
        >
          <AnimatedCounter value={value} suffix={suffix} />
        </motion.div>
        <div className="text-slate-600 font-medium">{label}</div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// STEP CARD
// =============================================================================

function StepCard({
  number,
  title,
  description,
  icon: Icon,
  isLast,
  delay,
}: {
  number: number;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isLast?: boolean;
  delay: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -40 }}
      animate={isInView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-start gap-6 group"
    >
      <div className="relative flex-shrink-0">
        <motion.div
          className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-xl shadow-teal-500/25"
          whileHover={{ scale: 1.1, rotate: 5 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Icon className="w-8 h-8 text-white" />
        </motion.div>
        {!isLast && (
          <motion.div
            className="absolute top-16 left-1/2 -translate-x-1/2 w-0.5 h-24 origin-top"
            style={{ background: "linear-gradient(to bottom, #14b8a6, transparent)" }}
            initial={{ scaleY: 0 }}
            animate={isInView ? { scaleY: 1 } : {}}
            transition={{ duration: 0.8, delay: delay + 0.3 }}
          />
        )}
      </div>
      <div className="pt-2 flex-1">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-bold text-teal-600 bg-teal-50 px-3 py-1 rounded-full">
            Step {number}
          </span>
        </div>
        <h4 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-teal-600 transition-colors">
          {title}
        </h4>
        <p className="text-slate-600 leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

// =============================================================================
// MAIN HOMEPAGE
// =============================================================================

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const heroRef = useRef<HTMLElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { scrollYProgress } = useScroll({
    target: isMounted ? heroRef : undefined,
    offset: ["start start", "end start"],
  });

  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.9]);
  const heroY = useTransform(scrollYProgress, [0, 0.5], [0, 150]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/jobs");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || isAuthenticated) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <motion.div
          className="w-16 h-16 border-4 border-teal-200 border-t-teal-600 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </main>
    );
  }

  const companies = ["Google", "Microsoft", "Meta", "Amazon", "Apple", "Netflix", "Stripe", "Airbnb"];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 overflow-x-hidden">
      <ScrollProgress />

      {/* =========== HEADER =========== */}
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 right-0 z-50"
      >
        <div className="mx-4 mt-4">
          <div className="max-w-7xl mx-auto bg-white/80 backdrop-blur-xl rounded-2xl border border-slate-200/50 shadow-lg shadow-slate-200/50">
            <div className="flex items-center justify-between px-6 py-3">
              <motion.div className="flex items-center gap-3" whileHover={{ scale: 1.02 }}>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/25">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-slate-900">Briefing Room</span>
              </motion.div>

              <div className="hidden md:flex items-center gap-8">
                <Link href="#features" className="text-sm font-medium text-slate-600 hover:text-teal-600 transition-colors">
                  Features
                </Link>
                <Link href="#how-it-works" className="text-sm font-medium text-slate-600 hover:text-teal-600 transition-colors">
                  How it Works
                </Link>
                <Link href="#pricing" className="text-sm font-medium text-slate-600 hover:text-teal-600 transition-colors">
                  Pricing
                </Link>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-teal-600 transition-colors"
                >
                  Sign In
                </Link>
                <MagneticButton>
                  <Link
                    href="/signup"
                    className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 rounded-xl shadow-lg shadow-teal-500/25 hover:shadow-xl transition-all"
                  >
                    Get Started Free
                  </Link>
                </MagneticButton>
              </div>
            </div>
          </div>
        </div>
      </motion.header>

      {/* =========== HERO =========== */}
      <section ref={heroRef} className="relative min-h-screen flex items-center pt-32 pb-20">
        <HeroScene />
        <GlowingOrbs />

        <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/40 to-slate-50 pointer-events-none" />

        <motion.div
          style={{ opacity: heroOpacity, scale: heroScale, y: heroY }}
          className="relative z-10 max-w-6xl mx-auto px-6 text-center"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-teal-500/10 to-orange-500/10 border border-teal-200/50 text-teal-700 text-sm font-medium shadow-sm">
              <motion.span
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Zap className="w-4 h-4" />
              </motion.span>
              End-to-End AI Recruiting Platform
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            className="mt-8 text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <span className="block text-slate-900">One Platform.</span>
            <span className="block text-gradient mt-2">Every Hire.</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            className="mt-8 text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            From job creation to offer letter — Briefing Room captures your
            <span className="text-teal-600 font-semibold"> entire recruiting pipeline </span>
            in one intelligent platform with AI copilots at every step.
          </motion.p>

          {/* CTA */}
          <motion.div
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
          >
            <MagneticButton>
              <Link
                href="/signup"
                className="group relative inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 rounded-2xl font-semibold text-lg text-white shadow-xl shadow-orange-500/25 hover:shadow-2xl transition-all overflow-hidden"
              >
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                <Play className="w-5 h-5" />
                Start Free Trial
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </MagneticButton>

            <Link
              href="#how-it-works"
              className="group inline-flex items-center gap-2 px-6 py-4 text-slate-700 hover:text-teal-600 font-medium rounded-2xl hover:bg-white/50 transition-all"
            >
              Watch Demo
              <motion.span animate={{ x: [0, 5, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                <ChevronRight className="w-5 h-5" />
              </motion.span>
            </Link>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            {[
              { icon: Shield, text: "SOC 2 Compliant" },
              { icon: Clock, text: "Setup in 5 minutes" },
              { icon: CheckCircle2, text: "No credit card required" },
            ].map((item, i) => (
              <motion.div
                key={i}
                className="flex items-center gap-2"
                whileHover={{ scale: 1.05, color: "#0d9488" }}
              >
                <item.icon className="w-4 h-4 text-teal-500" />
                <span>{item.text}</span>
              </motion.div>
            ))}
          </motion.div>

          {/* Pipeline visualization */}
          <motion.div
            className="mt-16 max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.8 }}
          >
            <PipelineVisualization />
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-6 h-10 rounded-full border-2 border-slate-300 flex items-start justify-center p-2">
            <motion.div
              className="w-1 h-2 bg-teal-500 rounded-full"
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
        </motion.div>
      </section>

      {/* =========== COMPANY LOGOS MARQUEE =========== */}
      <section className="py-12 bg-white border-y border-slate-200/50">
        <div className="text-center mb-8">
          <p className="text-sm text-slate-500 font-medium">Trusted by recruiting teams at</p>
        </div>
        <Marquee speed={40}>
          <div className="flex items-center gap-16 px-8">
            {companies.map((company, i) => (
              <span key={i} className="text-2xl font-bold text-slate-300 hover:text-slate-400 transition-colors">
                {company}
              </span>
            ))}
          </div>
        </Marquee>
      </section>

      {/* =========== STATS =========== */}
      <section className="py-24 relative overflow-hidden">
        <GlowingOrbs />
        <div className="max-w-6xl mx-auto px-6 relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <StatCard value={50} suffix="K+" label="Interviews Conducted" delay={0} />
            <StatCard value={85} suffix="%" label="Time Saved" delay={0.1} />
            <StatCard value={2} suffix="K+" label="Companies" delay={0.2} />
            <StatCard value={4} suffix="x" label="Better Hires" delay={0.3} />
          </div>
        </div>
      </section>

      {/* =========== HOW IT WORKS =========== */}
      <section id="how-it-works" className="py-24 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-sm font-semibold text-teal-600 bg-teal-50 px-4 py-2 rounded-full">
              HOW IT WORKS
            </span>
            <h2 className="mt-6 text-4xl md:text-5xl font-bold text-slate-900">
              Your Complete Recruiting Workflow
            </h2>
            <p className="mt-4 text-xl text-slate-600 max-w-2xl mx-auto">
              End-to-end hiring in one platform — no more switching between tools
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div className="space-y-8">
              <StepCard
                number={1}
                title="Create & Enrich Job Profiles"
                description="Paste any job description and watch AI extract requirements, suggest improvements, and build your ideal candidate profile."
                icon={FileText}
                delay={0}
              />
              <StepCard
                number={2}
                title="Source & Screen Candidates"
                description="AI reviews applications 24/7, ranking candidates by fit and surfacing hidden gems you might have missed."
                icon={Users}
                delay={0.15}
              />
              <StepCard
                number={3}
                title="Conduct AI-Powered Interviews"
                description="Our AI interviewer conducts consistent, unbiased conversations while your in-meeting copilot assists live interviews."
                icon={Video}
                delay={0.3}
              />
              <StepCard
                number={4}
                title="Analyze & Decide with Confidence"
                description="Get comprehensive scorecards, compare candidates side-by-side, and make data-driven hiring decisions."
                icon={PieChart}
                isLast
                delay={0.45}
              />
            </div>

            <motion.div
              className="sticky top-32"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <TiltCard>
                <div className="relative rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 p-8 shadow-2xl overflow-hidden">
                  {/* Animated gradient border */}
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-teal-500 via-orange-500 to-violet-500 opacity-20 animate-gradient" />

                  <div className="relative">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                    </div>

                    <div className="space-y-4 font-mono text-sm">
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-teal-400"
                      >
                        → Analyzing candidate: Sarah Chen
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                        className="text-slate-400"
                      >
                        ✓ Resume parsed (98% match)
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 }}
                        className="text-slate-400"
                      >
                        ✓ Interview completed (45 min)
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.8 }}
                        className="text-orange-400"
                      >
                        ⚡ Generating scorecard...
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 1.2 }}
                        className="mt-6 p-4 bg-slate-800/50 rounded-xl border border-slate-700"
                      >
                        <div className="text-emerald-400 text-lg font-semibold">
                          Recommendation: Strong Hire
                        </div>
                        <div className="text-slate-500 text-xs mt-1">
                          Technical: 9.2 | Communication: 8.8 | Culture: 9.0
                        </div>
                      </motion.div>
                    </div>
                  </div>
                </div>
              </TiltCard>
            </motion.div>
          </div>
        </div>
      </section>

      {/* =========== FEATURES BENTO GRID =========== */}
      <section id="features" className="py-24 bg-white relative overflow-hidden">
        <GlowingOrbs />

        <div className="max-w-6xl mx-auto px-6 relative">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-sm font-semibold text-orange-600 bg-orange-50 px-4 py-2 rounded-full">
              FEATURES
            </span>
            <h2 className="mt-6 text-4xl md:text-5xl font-bold text-slate-900">
              AI Copilots at Every Stage
            </h2>
            <p className="mt-4 text-xl text-slate-600 max-w-2xl mx-auto">
              Intelligent assistance that learns your hiring patterns and gets smarter with every decision
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <BentoCard
              icon={MessageSquare}
              title="In-Meeting Copilot"
              description="Real-time AI assistance during live interviews. Get suggested questions, catch red flags, and receive instant candidate insights as you talk."
              className="lg:col-span-2"
              gradient="from-teal-50 to-white"
              iconBg="bg-gradient-to-br from-teal-500 to-teal-600"
              size="lg"
              delay={0}
            />
            <BentoCard
              icon={BarChart3}
              title="Pipeline Analytics"
              description="Real-time visibility into your entire funnel with conversion insights and bottleneck detection."
              gradient="from-orange-50 to-white"
              iconBg="bg-gradient-to-br from-orange-500 to-orange-600"
              delay={0.1}
            />
            <BentoCard
              icon={Brain}
              title="Continuous Learning"
              description="AI that studies your successful hires and adapts to find more candidates like them."
              gradient="from-violet-50 to-white"
              iconBg="bg-gradient-to-br from-violet-500 to-violet-600"
              delay={0.2}
            />
            <BentoCard
              icon={Workflow}
              title="Unified Candidate Context"
              description="Every touchpoint — resume, screening call, interviews, assessments — connected in one intelligent profile that grows richer over time."
              className="lg:col-span-2"
              gradient="from-emerald-50 to-white"
              iconBg="bg-gradient-to-br from-emerald-500 to-emerald-600"
              size="lg"
              delay={0.3}
            />
          </div>
        </div>
      </section>

      {/* =========== CTA SECTION =========== */}
      <section className="py-32 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />

        {/* Animated orbs */}
        <motion.div
          className="absolute top-0 right-0 w-[600px] h-[600px] bg-teal-500/20 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], x: [0, 50, 0], y: [0, -30, 0] }}
          transition={{ duration: 10, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-orange-500/20 rounded-full blur-3xl"
          animate={{ scale: [1.2, 1, 1.2], x: [0, -30, 0], y: [0, 50, 0] }}
          transition={{ duration: 12, repeat: Infinity }}
        />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white/80 text-sm font-medium mb-8"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <Sparkles className="w-4 h-4" />
              Your entire recruiting stack, unified
            </motion.div>

            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              Stop Juggling Tools.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-orange-400">
                Start Hiring Smarter.
              </span>
            </h2>

            <p className="text-xl text-slate-300 mb-12 max-w-2xl mx-auto">
              Join thousands of teams who&apos;ve consolidated their recruiting into one AI-powered platform.
              From first touch to final offer — everything in one place.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <MagneticButton>
                <Link
                  href="/signup"
                  className="group relative inline-flex items-center gap-3 px-10 py-5 bg-white text-slate-900 rounded-2xl font-semibold text-lg shadow-2xl hover:shadow-white/25 transition-all overflow-hidden"
                >
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-teal-100 to-transparent" />
                  <span className="relative">Get Started Free</span>
                  <ArrowRight className="w-5 h-5 relative group-hover:translate-x-1 transition-transform" />
                </Link>
              </MagneticButton>

              <Link
                href="#"
                className="inline-flex items-center gap-2 px-6 py-4 text-white/80 hover:text-white font-medium transition-colors"
              >
                Schedule a Demo
                <ChevronRight className="w-5 h-5" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* =========== FOOTER =========== */}
      <footer className="py-16 bg-slate-900 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-white font-bold text-lg">Briefing Room</span>
                <p className="text-slate-500 text-sm">End-to-end AI recruiting</p>
              </div>
            </div>

            <div className="flex items-center gap-8 text-sm text-slate-400">
              <Link href="#" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="#" className="hover:text-white transition-colors">Terms</Link>
              <Link href="#" className="hover:text-white transition-colors">Security</Link>
              <Link href="#" className="hover:text-white transition-colors">Contact</Link>
            </div>

            <p className="text-slate-500 text-sm">
              &copy; {new Date().getFullYear()} Briefing Room. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
