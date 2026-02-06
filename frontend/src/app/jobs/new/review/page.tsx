"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Briefcase,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Mic,
  Plus,
  X,
  Clock,
  MapPin,
  Target,
  ThumbsUp,
  ThumbsDown,
  Brain,
  Heart,
  Ban,
  User,
  Pencil,
  Check,
  ChevronRight,
  Zap,
} from "lucide-react";
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

// Helper to get value from skill object or string
const getSkillValue = (skill: { value: string; weight?: number } | string): string => {
  return typeof skill === "string" ? skill : skill.value;
};

// Editable tag component
function EditableTag({
  value,
  onUpdate,
  onRemove,
  color,
  bgColor,
}: {
  value: string;
  onUpdate: (newValue: string) => void;
  onRemove: () => void;
  color: string;
  bgColor: string;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    if (editValue.trim()) {
      onUpdate(editValue.trim());
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") setEditing(false);
          }}
          autoFocus
          className="px-2 py-1 rounded text-sm font-medium focus:outline-none"
          style={{
            backgroundColor: tokens.bgInput,
            border: `1px solid ${tokens.borderFocus}`,
            color: tokens.textPrimary,
            width: Math.max(80, editValue.length * 8),
          }}
        />
        <button
          onClick={handleSave}
          className="p-1 rounded hover:bg-white/10"
          style={{ color: tokens.statusSuccess }}
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setEditing(false)}
          className="p-1 rounded hover:bg-white/10"
          style={{ color: tokens.textMuted }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <span
      className="px-3 py-1.5 rounded-lg text-sm font-medium inline-flex items-center gap-1.5 group cursor-pointer transition-all"
      style={{ backgroundColor: bgColor, color }}
      onClick={() => setEditing(true)}
    >
      {value}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/10"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

// Category card component
function CategoryCard({
  title,
  icon: Icon,
  items,
  onUpdate,
  onRemove,
  onAdd,
  color,
  bgColor,
  borderColor,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  items: string[];
  onUpdate: (index: number, newValue: string) => void;
  onRemove: (index: number) => void;
  onAdd: (value: string) => void;
  color: string;
  bgColor: string;
  borderColor: string;
}) {
  const [newItem, setNewItem] = useState("");
  const [showAddInput, setShowAddInput] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const handleAdd = () => {
    if (newItem.trim()) {
      onAdd(newItem.trim());
      setNewItem("");
      setShowAddInput(false);
    }
  };

  return (
    <div
      className="rounded-xl p-5"
      style={{
        backgroundColor: bgColor,
        border: `1px solid ${isEditing ? color : borderColor}`,
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color }} />
          <h4
            className="text-sm font-bold uppercase tracking-wider"
            style={{ color }}
          >
            {title}
          </h4>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: borderColor, color }}>
            {items.length}
          </span>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-200 flex items-center gap-1.5"
          style={{
            backgroundColor: isEditing ? color : tokens.bgInput,
            color: isEditing ? "#fff" : tokens.textSecondary,
            border: `1px solid ${isEditing ? color : tokens.borderSubtle}`,
          }}
        >
          {isEditing ? (
            <>
              <Check className="w-3.5 h-3.5" />
              Done
            </>
          ) : (
            <>
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </>
          )}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item, index) => (
          <div
            key={`${title}-${index}-${item}`}
            className="px-3 py-1.5 rounded-lg text-sm font-medium inline-flex items-center gap-1.5 group transition-all"
            style={{ backgroundColor: borderColor, color }}
          >
            {item}
            {isEditing && (
              <button
                onClick={() => onRemove(index)}
                className="p-0.5 rounded hover:bg-white/20 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
        {showAddInput ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") {
                  setShowAddInput(false);
                  setNewItem("");
                }
              }}
              autoFocus
              placeholder="Type and press Enter"
              className="px-2 py-1 rounded text-sm font-medium focus:outline-none"
              style={{
                backgroundColor: tokens.bgInput,
                border: `1px solid ${tokens.borderFocus}`,
                color: tokens.textPrimary,
                minWidth: 140,
              }}
            />
            <button
              onClick={() => {
                setShowAddInput(false);
                setNewItem("");
              }}
              className="p-1 rounded hover:bg-white/10"
              style={{ color: tokens.textMuted }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddInput(true)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors hover:opacity-80"
            style={{
              backgroundColor: borderColor,
              color,
              border: `1px dashed ${color}40`,
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        )}
      </div>
    </div>
  );
}

export default function ReviewJobPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, recruiter, token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Job draft data from session storage
  const [jobDraft, setJobDraft] = useState<{
    title: string;
    description: string;
    interviewStages: string[];
    stageIcons?: string[];
    voiceScreeningEnabled?: boolean;
    extractedRequirements: any;
    voiceMode: boolean;
  } | null>(null);

  // Editable title
  const [editingTitle, setEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");

  // Editable extracted data (converted to simple string arrays for editing)
  const [editedData, setEditedData] = useState<{
    required_skills: string[];
    preferred_skills: string[];
    success_signals: string[];
    red_flags: string[];
    behavioral_traits: string[];
    cultural_indicators: string[];
    deal_breakers: string[];
    years_experience: string;
    location: string;
    ideal_background: string;
  }>({
    required_skills: [],
    preferred_skills: [],
    success_signals: [],
    red_flags: [],
    behavioral_traits: [],
    cultural_indicators: [],
    deal_breakers: [],
    years_experience: "",
    location: "",
    ideal_background: "",
  });

  // Load data from session storage
  useEffect(() => {
    const stored = sessionStorage.getItem("jobDraft");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setJobDraft(parsed);
        setEditedTitle(parsed.title || "");

        // Convert extracted requirements to editable format
        const req = parsed.extractedRequirements || {};
        setEditedData({
          required_skills: (req.required_skills || []).map(getSkillValue),
          preferred_skills: (req.preferred_skills || []).map(getSkillValue),
          success_signals: (req.success_signals || []).map(getSkillValue),
          red_flags: (req.red_flags || []).map(getSkillValue),
          behavioral_traits: (req.behavioral_traits || []).map(getSkillValue),
          cultural_indicators: (req.cultural_indicators || []).map(getSkillValue),
          deal_breakers: (req.deal_breakers || []).map(getSkillValue),
          years_experience: req.years_experience || "",
          location: req.location || "",
          ideal_background: req.ideal_background || "",
        });
        setLoading(false);
      } catch (e) {
        console.error("Failed to parse job draft:", e);
        router.push("/jobs/new");
      }
    } else {
      // No draft data, redirect back
      router.push("/jobs/new");
    }
  }, [router]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, authLoading, router]);

  // Handle create job
  const handleCreateJob = async () => {
    if (!recruiter || !jobDraft) {
      setError("Missing required data. Please try again.");
      return;
    }

    if (!editedTitle.trim()) {
      setError("Job title is required");
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // Convert edited data back to the format the API expects
      const extractedRequirements = {
        required_skills: editedData.required_skills.map(v => ({ value: v, weight: 0.8 })),
        preferred_skills: editedData.preferred_skills.map(v => ({ value: v, weight: 0.5 })),
        success_signals: editedData.success_signals.map(v => ({ value: v, weight: 0.7 })),
        red_flags: editedData.red_flags.map(v => ({ value: v, weight: 0.6 })),
        behavioral_traits: editedData.behavioral_traits.map(v => ({ value: v, weight: 0.5 })),
        cultural_indicators: editedData.cultural_indicators.map(v => ({ value: v, weight: 0.5 })),
        deal_breakers: editedData.deal_breakers.map(v => ({ value: v, weight: 1.0 })),
        years_experience: editedData.years_experience,
        location: editedData.location,
        ideal_background: editedData.ideal_background,
      };

      const response = await fetch(`${API_URL}/api/jobs/`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: editedTitle.trim(),
          raw_description: jobDraft.description,
          recruiter_id: recruiter.id,
          status: "draft",
          interview_stages: jobDraft.interviewStages,
          interview_stage_icons: jobDraft.stageIcons || ["bot", "video", "building"],
          voice_screening_enabled: jobDraft.voiceScreeningEnabled !== false, // Default to true
          extracted_requirements: extractedRequirements,
        }),
      });

      if (response.ok) {
        const job = await response.json();
        // Clear session storage
        sessionStorage.removeItem("jobDraft");

        // Navigate based on voice mode
        if (jobDraft.voiceMode) {
          router.push(`/jobs/${job.id}/enrich`);
        } else {
          router.push(`/jobs/${job.id}`);
        }
      } else {
        const err = await response.json();
        setError(err.detail || "Failed to create job");
      }
    } catch (err) {
      setError("Failed to create job. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  // Update helper functions
  const updateCategory = (category: keyof typeof editedData, index: number, newValue: string) => {
    if (Array.isArray(editedData[category])) {
      const arr = [...(editedData[category] as string[])];
      arr[index] = newValue;
      setEditedData({ ...editedData, [category]: arr });
    }
  };

  const removeFromCategory = (category: keyof typeof editedData, index: number) => {
    if (Array.isArray(editedData[category])) {
      const arr = (editedData[category] as string[]).filter((_, i) => i !== index);
      setEditedData({ ...editedData, [category]: arr });
    }
  };

  const addToCategory = (category: keyof typeof editedData, value: string) => {
    if (Array.isArray(editedData[category])) {
      setEditedData({ ...editedData, [category]: [...(editedData[category] as string[]), value] });
    }
  };

  // Show loading
  if (authLoading || !isAuthenticated || loading || !jobDraft) {
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
        <div className="px-6 py-8">
          {/* Page Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-4 mb-8 max-w-7xl mx-auto"
          >
            <Link
              href="/jobs/new"
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
            <div className="flex-1">
              <h1
                className="text-2xl font-bold tracking-tight"
                style={{ color: tokens.textPrimary }}
              >
                Review Extracted Requirements
              </h1>
              <p
                className="text-sm mt-1"
                style={{ color: tokens.textMuted }}
              >
                Step 2 of 2 — Verify and edit before creating
              </p>
            </div>
          </motion.div>

          {/* Progress Indicator */}
          <JobCreationStepper currentStep={2} />

          {/* Error Alert */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-xl p-4 flex items-center gap-3 mb-6 max-w-7xl mx-auto"
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

          {/* Main Content - Split Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
            {/* Left Panel - Job Description */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="rounded-2xl p-6 h-fit lg:sticky lg:top-6"
              style={{
                backgroundColor: tokens.bgSurface,
                border: `1px solid ${tokens.borderDefault}`,
              }}
            >
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: "rgba(168,85,247,0.15)" }}
                >
                  <FileText className="w-5 h-5" style={{ color: "#A855F7" }} />
                </div>
                <div>
                  <h2
                    className="text-lg font-bold"
                    style={{ color: tokens.textPrimary }}
                  >
                    Job Description
                  </h2>
                  <p
                    className="text-xs"
                    style={{ color: tokens.textMuted }}
                  >
                    Original text used for extraction
                  </p>
                </div>
              </div>

              {/* Editable Title */}
              <div className="mb-5">
                <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: tokens.textMuted }}>
                  Job Title
                </label>
                {editingTitle ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      autoFocus
                      className="flex-1 px-4 py-3 rounded-xl text-lg font-bold focus:outline-none"
                      style={{
                        backgroundColor: tokens.bgInput,
                        border: `1px solid ${tokens.borderFocus}`,
                        color: tokens.textPrimary,
                      }}
                    />
                    <button
                      onClick={() => setEditingTitle(false)}
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: tokens.statusSuccess, color: "white" }}
                    >
                      <Check className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer group transition-colors"
                    style={{
                      backgroundColor: tokens.bgCard,
                      border: `1px solid ${tokens.borderSubtle}`,
                    }}
                    onClick={() => setEditingTitle(true)}
                  >
                    <span className="text-lg font-bold" style={{ color: tokens.textPrimary }}>
                      {editedTitle || "Untitled Job"}
                    </span>
                    <Pencil
                      className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: tokens.textMuted }}
                    />
                  </div>
                )}
              </div>

              {/* Description Text */}
              <div
                className="rounded-xl p-4 max-h-[60vh] overflow-y-auto"
                style={{
                  backgroundColor: tokens.bgCard,
                  border: `1px solid ${tokens.borderSubtle}`,
                }}
              >
                <pre
                  className="text-sm leading-relaxed whitespace-pre-wrap font-sans"
                  style={{ color: tokens.textSecondary }}
                >
                  {jobDraft.description}
                </pre>
              </div>

              {/* Interview Pipeline */}
              <div className="mt-5">
                <label className="text-xs font-bold uppercase tracking-wider block mb-3" style={{ color: tokens.textMuted }}>
                  Interview Pipeline
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  <div
                    className="px-3 py-1.5 rounded-lg"
                    style={{
                      backgroundColor: "rgba(99,102,241,0.1)",
                      border: "1px solid rgba(99,102,241,0.25)",
                    }}
                  >
                    <span className="font-semibold text-xs" style={{ color: tokens.brandSecondary }}>Screen</span>
                  </div>
                  <ChevronRight className="w-3 h-3" style={{ color: tokens.textMuted }} />
                  {jobDraft.interviewStages.map((stage, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div
                        className="px-3 py-1.5 rounded-lg"
                        style={{
                          backgroundColor: tokens.bgCard,
                          border: `1px solid ${tokens.borderSubtle}`,
                        }}
                      >
                        <span className="font-medium text-xs" style={{ color: tokens.textPrimary }}>{stage}</span>
                      </div>
                      {index < jobDraft.interviewStages.length - 1 && (
                        <ChevronRight className="w-3 h-3" style={{ color: tokens.textMuted }} />
                      )}
                    </div>
                  ))}
                  <ChevronRight className="w-3 h-3" style={{ color: tokens.textMuted }} />
                  <div
                    className="px-3 py-1.5 rounded-lg"
                    style={{
                      backgroundColor: "rgba(16,185,129,0.1)",
                      border: "1px solid rgba(16,185,129,0.25)",
                    }}
                  >
                    <span className="font-semibold text-xs" style={{ color: tokens.statusSuccess }}>Offer</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right Panel - Extracted Requirements */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="space-y-4"
            >
              {/* Success Banner */}
              <div
                className="rounded-xl p-4 flex items-center gap-3"
                style={{
                  background: `linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.05))`,
                  border: "1px solid rgba(16,185,129,0.3)",
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: "rgba(16,185,129,0.2)" }}
                >
                  <CheckCircle2 className="w-5 h-5" style={{ color: tokens.statusSuccess }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: tokens.textPrimary }}>
                    AI-Extracted Requirements
                  </h3>
                  <p className="text-xs" style={{ color: tokens.statusSuccess }}>
                    Click any item to edit • Click + to add new items
                  </p>
                </div>
              </div>

              {/* Basic Info */}
              {(editedData.years_experience || editedData.location) && (
                <div
                  className="rounded-xl p-5"
                  style={{
                    backgroundColor: tokens.bgCard,
                    border: `1px solid ${tokens.borderSubtle}`,
                  }}
                >
                  <h4
                    className="text-sm font-bold uppercase tracking-wider mb-4"
                    style={{ color: tokens.textPrimary }}
                  >
                    Basic Requirements
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    {editedData.years_experience && (
                      <div className="flex items-start gap-3">
                        <Clock className="w-5 h-5 mt-0.5" style={{ color: tokens.brandPrimary }} />
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: tokens.textMuted }}>
                            Experience
                          </span>
                          <p className="font-semibold" style={{ color: tokens.textPrimary }}>
                            {editedData.years_experience}
                          </p>
                        </div>
                      </div>
                    )}
                    {editedData.location && (
                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 mt-0.5" style={{ color: tokens.brandPrimary }} />
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: tokens.textMuted }}>
                            Location
                          </span>
                          <p className="font-semibold" style={{ color: tokens.textPrimary }}>
                            {editedData.location}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Required Skills */}
              {editedData.required_skills.length > 0 && (
                <CategoryCard
                  title="Required Skills"
                  icon={Target}
                  items={editedData.required_skills}
                  onUpdate={(i, v) => updateCategory("required_skills", i, v)}
                  onRemove={(i) => removeFromCategory("required_skills", i)}
                  onAdd={(v) => addToCategory("required_skills", v)}
                  color={tokens.brandSecondary}
                  bgColor="rgba(99, 102, 241, 0.08)"
                  borderColor="rgba(99, 102, 241, 0.25)"
                />
              )}

              {/* Nice to Have */}
              {editedData.preferred_skills.length > 0 && (
                <CategoryCard
                  title="Nice to Have"
                  icon={ThumbsUp}
                  items={editedData.preferred_skills}
                  onUpdate={(i, v) => updateCategory("preferred_skills", i, v)}
                  onRemove={(i) => removeFromCategory("preferred_skills", i)}
                  onAdd={(v) => addToCategory("preferred_skills", v)}
                  color={tokens.textSecondary}
                  bgColor={tokens.bgCard}
                  borderColor={tokens.borderSubtle}
                />
              )}

              {/* Green Flags */}
              {editedData.success_signals.length > 0 && (
                <CategoryCard
                  title="Green Flags"
                  icon={ThumbsUp}
                  items={editedData.success_signals}
                  onUpdate={(i, v) => updateCategory("success_signals", i, v)}
                  onRemove={(i) => removeFromCategory("success_signals", i)}
                  onAdd={(v) => addToCategory("success_signals", v)}
                  color={tokens.statusSuccess}
                  bgColor="rgba(16, 185, 129, 0.08)"
                  borderColor="rgba(16, 185, 129, 0.25)"
                />
              )}

              {/* Red Flags */}
              {editedData.red_flags.length > 0 && (
                <CategoryCard
                  title="Red Flags"
                  icon={ThumbsDown}
                  items={editedData.red_flags}
                  onUpdate={(i, v) => updateCategory("red_flags", i, v)}
                  onRemove={(i) => removeFromCategory("red_flags", i)}
                  onAdd={(v) => addToCategory("red_flags", v)}
                  color={tokens.statusDanger}
                  bgColor="rgba(239, 68, 68, 0.08)"
                  borderColor="rgba(239, 68, 68, 0.25)"
                />
              )}

              {/* Behavioral Traits */}
              {editedData.behavioral_traits.length > 0 && (
                <CategoryCard
                  title="Behavioral Traits"
                  icon={Brain}
                  items={editedData.behavioral_traits}
                  onUpdate={(i, v) => updateCategory("behavioral_traits", i, v)}
                  onRemove={(i) => removeFromCategory("behavioral_traits", i)}
                  onAdd={(v) => addToCategory("behavioral_traits", v)}
                  color={tokens.statusInfo}
                  bgColor="rgba(59, 130, 246, 0.08)"
                  borderColor="rgba(59, 130, 246, 0.25)"
                />
              )}

              {/* Cultural Fit */}
              {editedData.cultural_indicators.length > 0 && (
                <CategoryCard
                  title="Cultural Fit"
                  icon={Heart}
                  items={editedData.cultural_indicators}
                  onUpdate={(i, v) => updateCategory("cultural_indicators", i, v)}
                  onRemove={(i) => removeFromCategory("cultural_indicators", i)}
                  onAdd={(v) => addToCategory("cultural_indicators", v)}
                  color={tokens.statusWarning}
                  bgColor="rgba(245, 158, 11, 0.08)"
                  borderColor="rgba(245, 158, 11, 0.25)"
                />
              )}

              {/* Deal Breakers */}
              {editedData.deal_breakers.length > 0 && (
                <CategoryCard
                  title="Deal Breakers"
                  icon={Ban}
                  items={editedData.deal_breakers}
                  onUpdate={(i, v) => updateCategory("deal_breakers", i, v)}
                  onRemove={(i) => removeFromCategory("deal_breakers", i)}
                  onAdd={(v) => addToCategory("deal_breakers", v)}
                  color="#F43F5E"
                  bgColor="rgba(244, 63, 94, 0.08)"
                  borderColor="rgba(244, 63, 94, 0.3)"
                />
              )}

              {/* Ideal Background */}
              {editedData.ideal_background && (
                <div
                  className="rounded-xl p-5"
                  style={{
                    backgroundColor: tokens.bgCard,
                    border: `1px solid ${tokens.borderSubtle}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-4 h-4" style={{ color: tokens.textMuted }} />
                    <h4
                      className="text-sm font-bold uppercase tracking-wider"
                      style={{ color: tokens.textPrimary }}
                    >
                      Ideal Candidate Background
                    </h4>
                  </div>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: tokens.textSecondary }}
                  >
                    {editedData.ideal_background}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div
                className="flex items-center justify-between pt-6 mt-6"
                style={{ borderTop: `1px solid ${tokens.borderSubtle}` }}
              >
                <Link
                  href="/jobs/new"
                  className="px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200"
                  style={{
                    backgroundColor: tokens.bgInput,
                    color: tokens.textSecondary,
                    border: `1px solid ${tokens.borderSubtle}`,
                  }}
                >
                  Back to Edit
                </Link>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCreateJob}
                  disabled={creating || !editedTitle.trim()}
                  className="flex items-center gap-3 px-8 py-3.5 rounded-xl font-bold text-base transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: creating || !editedTitle.trim()
                      ? tokens.bgCardHover
                      : `linear-gradient(135deg, ${tokens.statusSuccess}, #059669)`,
                    color: creating || !editedTitle.trim()
                      ? tokens.textDisabled
                      : "white",
                    boxShadow: !creating && editedTitle.trim()
                      ? "0 4px 20px rgba(16,185,129,0.3)"
                      : "none",
                  }}
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creating...
                    </>
                  ) : jobDraft.voiceMode ? (
                    <>
                      <Mic className="w-5 h-5" />
                      Create & Start Voice Setup
                    </>
                  ) : (
                    <>
                      <Briefcase className="w-5 h-5" />
                      Create Job
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
