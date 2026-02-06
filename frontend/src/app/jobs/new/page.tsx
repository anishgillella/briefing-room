"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Briefcase,
  FileText,
  Loader2,
  Sparkles,
  AlertCircle,
  Mic,
  Plus,
  X,
  GripVertical,
  Wand2,
  Users,
  Zap,
  Eye,
  ChevronRight,
  Bot,
  Phone,
  Video,
  Building2,
  Check,
} from "lucide-react";
import JobArchitectChat from "@/components/JobArchitectChat";
import JobCreationStepper from "@/components/JobCreationStepper";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// =============================================================================
// DESIGN TOKENS - Premium Dark Theme
// =============================================================================
const tokens = {
  // Backgrounds
  bgApp: "#070B14",
  bgSurface: "#0C1322",
  bgSurfaceHover: "#111827",
  bgCard: "#0F172A",
  bgCardHover: "#1E293B",
  bgGlass: "rgba(15, 23, 42, 0.8)",
  bgInput: "rgba(255, 255, 255, 0.03)",
  bgInputHover: "rgba(255, 255, 255, 0.05)",
  bgInputFocus: "rgba(255, 255, 255, 0.07)",

  // Borders
  borderSubtle: "rgba(255,255,255,0.06)",
  borderDefault: "rgba(255,255,255,0.08)",
  borderHover: "rgba(255,255,255,0.12)",
  borderFocus: "rgba(99,102,241,0.5)",

  // Text
  textPrimary: "#F8FAFC",
  textSecondary: "#94A3B8",
  textMuted: "#64748B",
  textDisabled: "#475569",
  textPlaceholder: "rgba(255,255,255,0.25)",

  // Brand
  brandPrimary: "#6366F1",
  brandSecondary: "#818CF8",
  brandGlow: "rgba(99,102,241,0.15)",
  brandGlowStrong: "rgba(99,102,241,0.3)",

  // Status
  statusSuccess: "#10B981",
  statusWarning: "#F59E0B",
  statusDanger: "#EF4444",
  statusInfo: "#3B82F6",
};

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

function NewJobPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading, token } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Interview stages - default to 3 rounds
  const [interviewStages, setInterviewStages] = useState<string[]>([
    "Round 1",
    "Round 2",
    "Round 3",
  ]);
  const [stageIcons, setStageIcons] = useState<string[]>(["bot", "video", "building"]);
  const [voiceScreeningEnabled, setVoiceScreeningEnabled] = useState(true);
  const [showStagesEditor, setShowStagesEditor] = useState(false);
  const [creationMode, setCreationMode] = useState<"select" | "classic" | "architect">("select");
  const [architectJd, setArchitectJd] = useState<string | null>(null);

  // Icon options for stages
  const iconOptions = [
    { value: "bot", label: "AI Bot", icon: Bot },
    { value: "phone", label: "Phone", icon: Phone },
    { value: "video", label: "Video", icon: Video },
    { value: "building", label: "Onsite", icon: Building2 },
  ];

  // Check if voice mode is requested
  const voiceMode = searchParams.get("voice") === "true";

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, authLoading, router]);

  // Handle extract and navigate to review
  const handleExtractAndReview = async () => {
    if (!description.trim()) {
      setError("Please enter a job description first");
      return;
    }

    try {
      setExtracting(true);
      setError(null);

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/api/jobs/extract-requirements`, {
        method: "POST",
        headers,
        body: JSON.stringify({ description }),
      });

      if (response.ok) {
        const extractedRequirements = await response.json();

        // Store data in sessionStorage for the review page
        const jobDraft = {
          title: title.trim() || extractedRequirements.title || "",
          description: description.trim(),
          interviewStages,
          stageIcons,
          voiceScreeningEnabled,
          extractedRequirements,
          voiceMode,
        };
        sessionStorage.setItem("jobDraft", JSON.stringify(jobDraft));

        // Navigate to review page
        router.push("/jobs/new/review");
      } else {
        const err = await response.json();
        setError(err.detail || "Failed to extract requirements");
      }
    } catch (err) {
      setError("Failed to extract requirements. Please try again.");
    } finally {
      setExtracting(false);
    }
  };

  // Show loading while checking auth
  if (authLoading || !isAuthenticated) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 border-2 border-white/20 border-t-indigo-500 rounded-full"
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div
        className="min-h-screen"
        style={{ backgroundColor: tokens.bgApp }}
      >
        <div className="px-6 py-8 max-w-4xl mx-auto">
          {/* Page Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-4 mb-8"
          >
            <Link
              href="/jobs"
              className="p-2.5 rounded-xl transition-all duration-200 group"
              style={{
                backgroundColor: tokens.bgSurface,
                border: `1px solid ${tokens.borderDefault}`,
              }}
            >
              <ArrowLeft
                className="w-5 h-5 transition-transform group-hover:-translate-x-0.5"
                style={{ color: tokens.textSecondary }}
              />
            </Link>
            <div>
              <h1
                className="text-2xl font-bold tracking-tight"
                style={{ color: tokens.textPrimary }}
              >
                {voiceMode ? "Create Job with Voice Setup" : "Create New Job"}
              </h1>
              <p
                className="text-sm mt-1"
                style={{ color: tokens.textMuted }}
              >
                Step 1 of 2 — Enter job details
              </p>
            </div>
          </motion.div>

          {/* Progress Indicator */}
          <JobCreationStepper currentStep={1} />

          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="space-y-6"
          >
            {/* Voice Mode Banner */}
            <AnimatePresence>
              {voiceMode && (
                <motion.div
                  variants={fadeInUp}
                  className="rounded-2xl p-5 relative overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))`,
                    border: `1px solid rgba(99,102,241,0.3)`,
                  }}
                >
                  <div
                    className="absolute inset-0 opacity-30"
                    style={{
                      background: "radial-gradient(circle at 20% 50%, rgba(99,102,241,0.3), transparent 50%)",
                    }}
                  />
                  <div className="relative flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: "rgba(99,102,241,0.2)" }}
                    >
                      <Mic className="w-6 h-6" style={{ color: tokens.brandSecondary }} />
                    </div>
                    <div>
                      <h3
                        className="text-base font-bold"
                        style={{ color: tokens.textPrimary }}
                      >
                        Voice Setup Mode
                      </h3>
                      <p
                        className="text-sm mt-0.5"
                        style={{ color: tokens.textSecondary }}
                      >
                        After creating the job, you'll be guided through a voice conversation to enrich the job profile.
                      </p>
                    </div>
                    <Zap className="w-5 h-5 ml-auto" style={{ color: tokens.brandPrimary }} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error Alert */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl p-4 flex items-center gap-3"
                  style={{
                    backgroundColor: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.3)",
                  }}
                >
                  <AlertCircle className="w-5 h-5 shrink-0" style={{ color: tokens.statusDanger }} />
                  <p className="text-sm font-medium" style={{ color: "#FCA5A5" }}>{error}</p>
                  <button
                    onClick={() => setError(null)}
                    className="ml-auto p-1 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <X className="w-4 h-4" style={{ color: tokens.textMuted }} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>



            {/* Mode Selection */}
            <AnimatePresence mode="wait">
              {creationMode === "select" && (
                <motion.div
                  key="select"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  {/* Architect Mode Card */}
                  <button
                    onClick={() => setCreationMode("architect")}
                    className="text-left p-6 rounded-2xl border transition-all duration-300 hover:scale-[1.02] group relative overflow-hidden"
                    style={{
                      backgroundColor: tokens.bgSurface,
                      borderColor: tokens.brandPrimary,
                      boxShadow: `0 0 20px -5px ${tokens.brandGlowStrong}`
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:rotate-12"
                      style={{ backgroundColor: tokens.brandPrimary }}>
                      <Bot className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">AI Architect</h3>
                    <p className="text-sm leading-relaxed" style={{ color: tokens.textSecondary }}>
                      Don't have a JD yet? Let our AI interview you to discover the role, check market rates, and build a perfect description from scratch.
                    </p>
                    <div className="mt-4 inline-flex items-center text-sm font-semibold" style={{ color: tokens.brandSecondary }}>
                      Start Discovery <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>

                  {/* Classic Mode Card */}
                  <button
                    onClick={() => setCreationMode("classic")}
                    className="text-left p-6 rounded-2xl border transition-all duration-300 hover:scale-[1.02] group"
                    style={{
                      backgroundColor: tokens.bgSurface,
                      borderColor: tokens.borderSubtle
                    }}
                  >
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                      style={{ backgroundColor: tokens.bgCard }}>
                      <FileText className="w-6 h-6" style={{ color: tokens.textSecondary }} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Paste Description</h3>
                    <p className="text-sm leading-relaxed" style={{ color: tokens.textSecondary }}>
                      Already have a Job Description? Paste it here and our AI will extract the requirements, skills, and scoring criteria automatically.
                    </p>
                    <div className="mt-4 inline-flex items-center text-sm font-semibold" style={{ color: tokens.textMuted }}>
                      Use Classic Editor <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>
                </motion.div>
              )}

              {creationMode === "architect" && (
                <motion.div
                  key="architect"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <JobArchitectChat
                    onCancel={() => setCreationMode("select")}
                    onComplete={(jd, generatedTitle) => {
                      setDescription(jd);
                      if (generatedTitle) setTitle(generatedTitle);
                      setCreationMode("classic"); // Switch to classic view to review/edit
                    }}
                  />
                </motion.div>
              )}

              {creationMode === "classic" && (
                <motion.div
                  key="classic"
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={{
                    initial: { opacity: 0 },
                    animate: { opacity: 1, transition: { staggerChildren: 0.1 } },
                    exit: { opacity: 0 }
                  }}
                  className="space-y-6"
                >
                  {/* Job Title */}
                  <motion.div
                    variants={fadeInUp}
                    className="rounded-2xl p-6 transition-all duration-200"
                    style={{
                      backgroundColor: tokens.bgSurface,
                      border: `1px solid ${focusedField === "title" ? tokens.borderFocus : tokens.borderDefault}`,
                      boxShadow: focusedField === "title" ? `0 0 0 3px ${tokens.brandGlow}` : "none",
                    }}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: tokens.brandGlow }}
                      >
                        <Briefcase className="w-5 h-5" style={{ color: tokens.brandPrimary }} />
                      </div>
                      <div>
                        <label
                          className="block text-sm font-bold"
                          style={{ color: tokens.textPrimary }}
                        >
                          Job Title
                        </label>
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: tokens.textMuted }}
                        >
                          What role are you hiring for?
                        </p>
                      </div>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g., Senior Software Engineer, Product Manager"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onFocus={() => setFocusedField("title")}
                      onBlur={() => setFocusedField(null)}
                      className="w-full px-4 py-3.5 rounded-xl text-base font-medium transition-all duration-200 focus:outline-none placeholder:font-normal"
                      style={{
                        backgroundColor: tokens.bgInput,
                        border: `1px solid ${tokens.borderSubtle}`,
                        color: tokens.textPrimary,
                      }}
                    />
                    <p className="text-xs mt-2" style={{ color: tokens.textMuted }}>
                      Optional — AI will suggest a title from the job description if left blank
                    </p>
                  </motion.div>

                  {/* Job Description */}
                  <motion.div
                    variants={fadeInUp}
                    className="rounded-2xl p-6 transition-all duration-200"
                    style={{
                      backgroundColor: tokens.bgSurface,
                      border: `1px solid ${focusedField === "description" ? tokens.borderFocus : tokens.borderDefault}`,
                      boxShadow: focusedField === "description" ? `0 0 0 3px ${tokens.brandGlow}` : "none",
                    }}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: "rgba(168,85,247,0.15)" }}
                      >
                        <FileText className="w-5 h-5" style={{ color: "#A855F7" }} />
                      </div>
                      <div>
                        <label
                          className="block text-sm font-bold"
                          style={{ color: tokens.textPrimary }}
                        >
                          Job Description
                        </label>
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: tokens.textMuted }}
                        >
                          Paste the full job description — our AI will extract key requirements
                        </p>
                      </div>
                    </div>
                    <textarea
                      placeholder="Paste the full job description here...

Include responsibilities, requirements, qualifications, and any other relevant details. Our AI will automatically extract:

• Required and preferred skills
• Experience requirements
• Green flags and red flags
• Behavioral traits
• Cultural fit indicators
• And more..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      onFocus={() => setFocusedField("description")}
                      onBlur={() => setFocusedField(null)}
                      rows={14}
                      className="w-full px-4 py-3.5 rounded-xl text-sm leading-relaxed resize-none transition-all duration-200 focus:outline-none"
                      style={{
                        backgroundColor: tokens.bgInput,
                        border: `1px solid ${tokens.borderSubtle}`,
                        color: tokens.textPrimary,
                      }}
                    />
                    {description.length > 0 && (
                      <div className="mt-3 flex items-center justify-between">
                        <span
                          className="text-xs font-medium"
                          style={{ color: tokens.textMuted }}
                        >
                          {description.length.toLocaleString()} characters
                        </span>
                        {description.length > 100 && (
                          <span
                            className="text-xs flex items-center gap-1.5 font-medium"
                            style={{ color: tokens.statusSuccess }}
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            Ready for AI extraction
                          </span>
                        )}
                      </div>
                    )}
                  </motion.div>

                  {/* Interview Pipeline */}
                  <motion.div
                    variants={fadeInUp}
                    className="rounded-2xl p-6"
                    style={{
                      backgroundColor: tokens.bgSurface,
                      border: `1px solid ${tokens.borderDefault}`,
                    }}
                  >
                    <div className="flex items-start justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: "rgba(16,185,129,0.15)" }}
                        >
                          <Users className="w-5 h-5" style={{ color: tokens.statusSuccess }} />
                        </div>
                        <div>
                          <label
                            className="block text-sm font-bold"
                            style={{ color: tokens.textPrimary }}
                          >
                            Interview Pipeline
                          </label>
                          <p
                            className="text-xs mt-0.5"
                            style={{ color: tokens.textMuted }}
                          >
                            Configure the stages candidates go through
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowStagesEditor(!showStagesEditor)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                        style={{
                          backgroundColor: showStagesEditor ? tokens.brandGlow : tokens.bgInput,
                          color: showStagesEditor ? tokens.brandSecondary : tokens.textSecondary,
                          border: `1px solid ${showStagesEditor ? "rgba(99,102,241,0.3)" : tokens.borderSubtle}`,
                        }}
                      >
                        {showStagesEditor ? "Done" : "Customize"}
                      </button>
                    </div>

                    {/* Pipeline Preview */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* AI Screen stage - only shows when voice screening is enabled */}
                      {voiceScreeningEnabled && (
                        <>
                          <div
                            className="px-4 py-2.5 rounded-xl flex items-center gap-2"
                            style={{
                              backgroundColor: "rgba(99,102,241,0.1)",
                              border: "1px solid rgba(99,102,241,0.25)",
                            }}
                          >
                            <Bot className="w-4 h-4" style={{ color: tokens.brandSecondary }} />
                            <span className="font-semibold text-sm" style={{ color: tokens.brandSecondary }}>AI Screen</span>
                          </div>
                          <ChevronRight className="w-4 h-4" style={{ color: tokens.textMuted }} />
                        </>
                      )}

                      {interviewStages.map((stage, index) => {
                        const iconConfig = iconOptions.find(opt => opt.value === stageIcons[index]) || iconOptions[0];
                        const IconComponent = iconConfig.icon;
                        return (
                          <div key={index} className="flex items-center gap-2">
                            <div
                              className="px-4 py-2.5 rounded-xl flex items-center gap-2"
                              style={{
                                backgroundColor: tokens.bgCard,
                                border: `1px solid ${tokens.borderSubtle}`,
                              }}
                            >
                              <IconComponent className="w-4 h-4" style={{ color: tokens.textSecondary }} />
                              <span className="font-medium text-sm" style={{ color: tokens.textPrimary }}>{stage}</span>
                            </div>
                            {index < interviewStages.length - 1 && (
                              <ChevronRight className="w-4 h-4" style={{ color: tokens.textMuted }} />
                            )}
                          </div>
                        );
                      })}

                      <ChevronRight className="w-4 h-4" style={{ color: tokens.textMuted }} />
                      <div
                        className="px-4 py-2.5 rounded-xl"
                        style={{
                          backgroundColor: "rgba(16,185,129,0.1)",
                          border: "1px solid rgba(16,185,129,0.25)",
                        }}
                      >
                        <span className="font-semibold text-sm" style={{ color: tokens.statusSuccess }}>Offer</span>
                      </div>
                    </div>

                    {/* Voice Screening Toggle */}
                    <div
                      className="mt-5 pt-5 flex items-center justify-between"
                      style={{ borderTop: `1px solid ${tokens.borderSubtle}` }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: voiceScreeningEnabled ? "rgba(99,102,241,0.15)" : tokens.bgInput }}
                        >
                          <Bot className="w-5 h-5" style={{ color: voiceScreeningEnabled ? tokens.brandPrimary : tokens.textMuted }} />
                        </div>
                        <div>
                          <span className="text-sm font-bold" style={{ color: tokens.textPrimary }}>
                            AI Voice Screening
                          </span>
                          <p className="text-xs mt-0.5" style={{ color: tokens.textMuted }}>
                            Strong Fit candidates get an AI screening interview
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setVoiceScreeningEnabled(!voiceScreeningEnabled)}
                        className="relative w-14 h-7 rounded-full transition-all duration-300"
                        style={{
                          backgroundColor: voiceScreeningEnabled ? tokens.brandPrimary : tokens.bgInput,
                          border: `1px solid ${voiceScreeningEnabled ? tokens.brandPrimary : tokens.borderSubtle}`,
                        }}
                      >
                        <div
                          className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 flex items-center justify-center"
                          style={{
                            left: voiceScreeningEnabled ? "calc(100% - 26px)" : "2px",
                          }}
                        >
                          {voiceScreeningEnabled && <Check className="w-3 h-3" style={{ color: tokens.brandPrimary }} />}
                        </div>
                      </button>
                    </div>

                    {/* Stages Editor */}
                    <AnimatePresence>
                      {showStagesEditor && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-6 pt-6 space-y-4"
                          style={{ borderTop: `1px solid ${tokens.borderSubtle}` }}
                        >
                          <p className="text-sm" style={{ color: tokens.textSecondary }}>
                            Customize stage names and icons:
                          </p>
                          <div className="space-y-3">
                            {interviewStages.map((stage, index) => {
                              const currentIcon = iconOptions.find(opt => opt.value === stageIcons[index]) || iconOptions[0];
                              return (
                                <div
                                  key={index}
                                  className="flex items-center gap-3"
                                >
                                  <GripVertical className="w-4 h-4 cursor-grab" style={{ color: tokens.textMuted }} />
                                  <span
                                    className="text-sm font-medium w-8"
                                    style={{ color: tokens.textMuted }}
                                  >
                                    {index + 1}.
                                  </span>
                                  {/* Icon Selector */}
                                  <select
                                    value={stageIcons[index] || "bot"}
                                    onChange={(e) => {
                                      const newIcons = [...stageIcons];
                                      newIcons[index] = e.target.value;
                                      setStageIcons(newIcons);
                                    }}
                                    className="px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 focus:outline-none appearance-none cursor-pointer"
                                    style={{
                                      backgroundColor: tokens.bgInput,
                                      border: `1px solid ${tokens.borderSubtle}`,
                                      color: tokens.textPrimary,
                                      width: "100px",
                                    }}
                                  >
                                    {iconOptions.map(opt => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    type="text"
                                    value={stage}
                                    onChange={(e) => {
                                      const newStages = [...interviewStages];
                                      newStages[index] = e.target.value;
                                      setInterviewStages(newStages);
                                    }}
                                    className="flex-1 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 focus:outline-none"
                                    style={{
                                      backgroundColor: tokens.bgInput,
                                      border: `1px solid ${tokens.borderSubtle}`,
                                      color: tokens.textPrimary,
                                    }}
                                  />
                                  {interviewStages.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setInterviewStages(interviewStages.filter((_, i) => i !== index));
                                        setStageIcons(stageIcons.filter((_, i) => i !== index));
                                      }}
                                      className="p-2 rounded-lg transition-colors hover:bg-red-500/10"
                                      style={{ color: tokens.textMuted }}
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setInterviewStages([...interviewStages, `Round ${interviewStages.length + 1}`]);
                              setStageIcons([...stageIcons, "video"]);
                            }}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-colors"
                            style={{
                              backgroundColor: tokens.bgInput,
                              border: `1px dashed ${tokens.borderDefault}`,
                              color: tokens.textSecondary,
                            }}
                          >
                            <Plus className="w-4 h-4" />
                            Add Interview Stage
                          </button>
                          {interviewStages.length !== 3 && (
                            <button
                              type="button"
                              onClick={() => setInterviewStages(["Round 1", "Round 2", "Round 3"])}
                              className="text-xs font-medium hover:underline"
                              style={{ color: tokens.textMuted }}
                            >
                              Reset to default (3 rounds)
                            </button>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {/* Actions */}
                  <motion.div
                    variants={fadeInUp}
                    className="flex items-center justify-between pt-4"
                    style={{ borderTop: `1px solid ${tokens.borderSubtle}` }}
                  >
                    <Link
                      href="/jobs"
                      className="px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200"
                      style={{
                        backgroundColor: tokens.bgInput,
                        color: tokens.textSecondary,
                        border: `1px solid ${tokens.borderSubtle}`,
                      }}
                    >
                      Cancel
                    </Link>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleExtractAndReview}
                      disabled={extracting || !description.trim()}
                      className="flex items-center gap-3 px-8 py-3.5 rounded-xl font-bold text-base transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: extracting || !description.trim()
                          ? tokens.bgCardHover
                          : `linear-gradient(135deg, ${tokens.brandPrimary}, #8B5CF6)`,
                        color: extracting || !description.trim()
                          ? tokens.textDisabled
                          : "white",
                        boxShadow: !extracting && description.trim()
                          ? `0 4px 20px ${tokens.brandGlowStrong}`
                          : "none",
                      }}
                    >
                      {extracting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Extracting...
                        </>
                      ) : (
                        <>
                          <Eye className="w-5 h-5" />
                          Extract & Review
                          <ChevronRight className="w-5 h-5 -mr-1" />
                        </>
                      )}
                    </motion.button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function NewJobPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="flex items-center justify-center py-20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-8 h-8 border-2 border-white/20 border-t-indigo-500 rounded-full"
            />
          </div>
        </AppLayout>
      }
    >
      <NewJobPageContent />
    </Suspense>
  );
}
