"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { useJobs, useDeleteJob, type Job, type StageCount } from "@/hooks/useApi";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Plus,
  Briefcase,
  Users,
  CheckCircle,
  ChevronRight,
  Trash2,
  Mic,
  Sparkles,
  X,
  AlertTriangle,
  Search,
  Command,
  TrendingUp,
  Clock,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SkeletonCard } from "@/components/ui/skeleton";
import { tokens, springConfig, easeOutCustom } from "@/lib/design-tokens";

// =============================================================================
// PIPELINE HEALTH
// =============================================================================
type PipelineHealth = "healthy" | "slow" | "at_risk";

function getPipelineHealth(interviewed: number, total: number): PipelineHealth {
  if (total === 0) return "healthy";
  const ratio = interviewed / total;
  if (ratio >= 0.3) return "healthy";
  if (ratio >= 0.1) return "slow";
  return "at_risk";
}

// =============================================================================
// STAT CARD - Premium Design
// =============================================================================
function StatCard({
  icon: Icon,
  value,
  label,
  trend,
  variant = "default",
  delay = 0,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
  trend?: { value: number; isPositive: boolean };
  variant?: "default" | "success" | "warning" | "danger";
  delay?: number;
}) {
  const variantStyles = {
    default: {
      iconBg: tokens.brandGlow,
      iconColor: tokens.brandPrimary,
      glow: "none",
    },
    success: {
      iconBg: "rgba(16,185,129,0.15)",
      iconColor: tokens.statusSuccess,
      glow: "none",
    },
    warning: {
      iconBg: "rgba(245,158,11,0.15)",
      iconColor: tokens.statusWarning,
      glow: "none",
    },
    danger: {
      iconBg: "rgba(239,68,68,0.1)",
      iconColor: tokens.statusDanger,
      glow: "inset 0 0 0 1px rgba(239,68,68,0.2), 0 0 20px rgba(239,68,68,0.1)",
    },
  };

  const styles = variantStyles[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: easeOutCustom }}
      whileHover={{
        y: -4,
        transition: springConfig,
      }}
      className="group relative cursor-default"
    >
      {/* Card */}
      <div
        className="relative p-5 rounded-2xl transition-all duration-300"
        style={{
          backgroundColor: tokens.bgSurface,
          border: `1px solid ${tokens.borderDefault}`,
          boxShadow: styles.glow,
        }}
      >
        {/* Hover glow */}
        <div
          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at 50% 0%, ${styles.iconColor}10, transparent 70%)`,
          }}
        />

        <div className="relative flex items-start justify-between">
          <div className="flex-1">
            <p
              className="text-sm font-medium mb-2"
              style={{ color: tokens.textMuted }}
            >
              {label}
            </p>
            <div className="flex items-baseline gap-3">
              <p
                className="text-3xl font-semibold tracking-tight tabular-nums"
                style={{
                  color: tokens.textPrimary,
                  fontFamily: "var(--font-mono), monospace",
                }}
              >
                {value}
              </p>
              {trend && (
                <span
                  className="flex items-center gap-1 text-xs font-medium"
                  style={{
                    color: trend.isPositive
                      ? tokens.statusSuccess
                      : tokens.statusDanger,
                  }}
                >
                  <TrendingUp
                    className={`w-3 h-3 ${!trend.isPositive ? "rotate-180" : ""}`}
                  />
                  {trend.value}%
                </span>
              )}
            </div>
          </div>

          {/* Icon */}
          <div
            className="p-3 rounded-xl transition-transform duration-300 group-hover:scale-110"
            style={{ backgroundColor: styles.iconBg }}
          >
            <Icon className="w-5 h-5" style={{ color: styles.iconColor }} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// STATUS BADGE
// =============================================================================
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; dot: string }> = {
    active: {
      bg: "rgba(16,185,129,0.1)",
      text: tokens.statusSuccess,
      dot: tokens.statusSuccess,
    },
    draft: {
      bg: "rgba(100,116,139,0.1)",
      text: tokens.textMuted,
      dot: tokens.textMuted,
    },
    paused: {
      bg: "rgba(245,158,11,0.1)",
      text: tokens.statusWarning,
      dot: tokens.statusWarning,
    },
    closed: {
      bg: "rgba(100,116,139,0.1)",
      text: tokens.textDisabled,
      dot: tokens.textDisabled,
    },
  };

  const style = config[status] || config.draft;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: style.dot }}
      />
      {status}
    </span>
  );
}


// =============================================================================
// JOB CARD - Redesigned with Pipeline Stage Counts
// =============================================================================
function JobCard({
  job,
  onDelete,
  isDeleting,
  onClick,
  index,
}: {
  job: Job;
  onDelete: (jobId: string, e: React.MouseEvent) => void;
  isDeleting: boolean;
  onClick: () => void;
  index: number;
}) {
  const shouldReduceMotion = useReducedMotion();
  const health = getPipelineHealth(job.interviewed_count, job.candidate_count);

  const healthConfig = {
    healthy: { color: tokens.statusSuccess, label: "On Track", bg: "rgba(16,185,129,0.1)" },
    slow: { color: tokens.statusWarning, label: "Needs Push", bg: "rgba(245,158,11,0.1)" },
    at_risk: { color: tokens.statusDanger, label: "At Risk", bg: "rgba(239,68,68,0.1)" },
  };

  const { color: healthColor, label: healthLabel, bg: healthBg } = healthConfig[health];

  // Use actual stage_counts from API, with fallback for backward compatibility
  const pipelineStages = job.stage_counts && job.stage_counts.length > 0
    ? job.stage_counts.map((stage, index) => ({
      label: stage.stage_name,
      count: stage.count,
      color: stage.stage_key === "new"
        ? tokens.brandSecondary      // Screen = secondary brand color
        : stage.stage_key === "offer"
          ? tokens.statusSuccess     // Offer = green
          : tokens.brandPrimary,     // Interview stages = primary brand color
    }))
    : [
      // Fallback to calculated values if stage_counts not available
      { label: "Screen", count: job.candidate_count - job.interviewed_count, color: tokens.brandSecondary },
      { label: "Interview", count: job.interviewed_count, color: tokens.brandPrimary },
      { label: "Offer", count: 0, color: tokens.statusSuccess },
    ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.06,
        ease: easeOutCustom,
      }}
      whileHover={{ y: -2 }}
      className="group relative cursor-pointer"
      onClick={onClick}
    >
      <div
        className="relative rounded-2xl transition-all duration-300 overflow-hidden"
        style={{
          backgroundColor: tokens.bgCard,
          border: `1px solid ${tokens.borderDefault}`,
        }}
      >
        {/* Hover gradient overlay */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: `linear-gradient(135deg, ${tokens.brandGlow} 0%, transparent 60%)`,
          }}
        />

        {/* Main Content */}
        <div className="relative p-5">
          {/* Top Row: Title, Status, Health, Actions */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Job Icon */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105"
                style={{
                  background: `linear-gradient(135deg, ${tokens.brandPrimary}15, ${tokens.brandPrimary}08)`,
                  border: `1px solid ${tokens.brandPrimary}20`,
                }}
              >
                <Briefcase className="w-4.5 h-4.5" style={{ color: tokens.brandPrimary }} />
              </div>

              {/* Title & Meta */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5 mb-0.5">
                  <h3
                    className="text-[15px] font-semibold truncate transition-colors"
                    style={{ color: tokens.textPrimary }}
                  >
                    {job.title}
                  </h3>
                  <StatusBadge status={job.status} />
                </div>
                <p className="text-xs" style={{ color: tokens.textMuted }}>
                  {new Date(job.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            {/* Right: Health Status + Actions */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Actions */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(job.id, e);
                  }}
                  disabled={isDeleting}
                  className="p-2 rounded-lg transition-all duration-150 hover:bg-red-500/10"
                  style={{ color: tokens.textMuted }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = tokens.statusDanger)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = tokens.textMuted)}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="p-2" style={{ color: tokens.textMuted }}>
                  <ChevronRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          </div>

          {/* Pipeline Stages with Counts */}
          <div
            className="flex items-stretch gap-1 p-3 rounded-xl"
            style={{ backgroundColor: "rgba(255,255,255,0.02)" }}
          >
            {pipelineStages.map((stage, i) => {
              const isActive = stage.count > 0;
              const isLast = i === pipelineStages.length - 1;

              return (
                <div key={stage.label} className="flex items-center flex-1">
                  {/* Stage Card */}
                  <div
                    className="flex-1 flex flex-col items-center py-3 px-4 rounded-lg transition-all duration-200"
                    style={{
                      backgroundColor: isActive ? "rgba(255,255,255,0.04)" : "transparent",
                    }}
                  >
                    <p
                      className="text-2xl font-semibold tabular-nums mb-1"
                      style={{
                        color: isActive ? stage.color : tokens.textDisabled,
                        fontFamily: "var(--font-mono), monospace",
                      }}
                    >
                      {stage.count}
                    </p>
                    <p
                      className="text-[11px] font-medium uppercase tracking-wide"
                      style={{ color: isActive ? tokens.textSecondary : tokens.textDisabled }}
                    >
                      {stage.label}
                    </p>
                  </div>

                  {/* Arrow Connector */}
                  {!isLast && (
                    <div className="px-2 flex items-center">
                      <ChevronRight
                        className="w-4 h-4"
                        style={{ color: tokens.textDisabled, opacity: 0.4 }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// COMMAND BAR
// =============================================================================
function CommandBar({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  filterTabs,
}: {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  filterTabs: { id: string; label: string; count?: number }[];
}) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("job-search")?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3, ease: easeOutCustom }}
      className="relative mb-6"
    >
      {/* Glass card */}
      <div
        className="relative p-4 rounded-2xl backdrop-blur-xl"
        style={{
          backgroundColor: tokens.bgGlass,
          border: `1px solid ${tokens.borderDefault}`,
          boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
        }}
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200"
              style={{ color: isSearchFocused ? tokens.textSecondary : tokens.textMuted }}
            />
            <input
              id="job-search"
              type="text"
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              className="w-full pl-10 pr-20 py-2.5 rounded-xl text-sm transition-all duration-200 outline-none"
              style={{
                backgroundColor: isSearchFocused
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(255,255,255,0.04)",
                border: `1px solid ${isSearchFocused ? tokens.borderFocus : tokens.borderSubtle}`,
                color: tokens.textPrimary,
                boxShadow: isSearchFocused
                  ? `0 0 0 4px ${tokens.brandGlow}`
                  : "none",
              }}
            />
            {/* Keyboard hint */}
            <div
              className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none"
              style={{ color: tokens.textDisabled }}
            >
              <kbd
                className="px-1.5 py-0.5 text-[10px] font-medium rounded"
                style={{
                  backgroundColor: "rgba(255,255,255,0.06)",
                  border: `1px solid ${tokens.borderSubtle}`,
                }}
              >
                <Command className="w-2.5 h-2.5 inline" />
              </kbd>
              <kbd
                className="px-1.5 py-0.5 text-[10px] font-medium rounded"
                style={{
                  backgroundColor: "rgba(255,255,255,0.06)",
                  border: `1px solid ${tokens.borderSubtle}`,
                }}
              >
                K
              </kbd>
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-16 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/10 transition-colors"
                style={{ color: tokens.textMuted }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Divider */}
          <div
            className="hidden sm:block w-px h-8"
            style={{ backgroundColor: tokens.borderSubtle }}
          />

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {filterTabs.map((tab) => {
              const isActive = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className="relative px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap"
                  style={{
                    color: isActive ? tokens.textPrimary : tokens.textMuted,
                    backgroundColor: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                  }}
                >
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span
                      className="ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-full"
                      style={{
                        backgroundColor: isActive
                          ? tokens.brandGlow
                          : "rgba(255,255,255,0.06)",
                        color: isActive ? tokens.brandPrimary : tokens.textMuted,
                      }}
                    >
                      {tab.count}
                    </span>
                  )}
                  {isActive && (
                    <motion.div
                      layoutId="activeFilterTab"
                      className="absolute inset-0 rounded-lg -z-10"
                      style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// EMPTY STATE
// =============================================================================
function EmptyState({ searchQuery, onCreateJob, onVoiceSetup }: {
  searchQuery: string;
  onCreateJob: () => void;
  onVoiceSetup: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: easeOutCustom }}
      className="text-center py-20"
    >
      <div
        className="relative inline-flex p-6 rounded-3xl mb-8"
        style={{
          background: `linear-gradient(135deg, ${tokens.brandGlow} 0%, transparent 100%)`,
          border: `1px solid ${tokens.borderDefault}`,
        }}
      >
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <Briefcase className="w-16 h-16" style={{ color: tokens.brandPrimary }} />
        </motion.div>
        {/* Floating sparkles */}
        <motion.div
          className="absolute -top-2 -right-2"
          animate={{ rotate: [0, 15, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Sparkles className="w-6 h-6" style={{ color: tokens.brandSecondary }} />
        </motion.div>
      </div>

      <h3
        className="text-2xl font-semibold mb-3"
        style={{ color: tokens.textPrimary }}
      >
        {searchQuery ? "No jobs found" : "Create your first job"}
      </h3>
      <p
        className="text-base mb-8 max-w-md mx-auto"
        style={{ color: tokens.textSecondary }}
      >
        {searchQuery
          ? "Try adjusting your search or filter criteria."
          : "Get started by creating a job posting. Paste your job description and we'll extract the requirements automatically."}
      </p>

      {!searchQuery && (
        <>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Button
              onClick={onCreateJob}
              leftIcon={<Plus className="w-4 h-4" />}
              size="lg"
            >
              Create from JD
            </Button>
            <span style={{ color: tokens.textMuted }}>or</span>
            <Button
              variant="secondary"
              onClick={onVoiceSetup}
              leftIcon={<Mic className="w-4 h-4" style={{ color: tokens.brandPrimary }} />}
              rightIcon={<Zap className="w-3 h-3" style={{ color: tokens.statusWarning }} />}
              size="lg"
            >
              Voice Setup
            </Button>
          </div>

          {/* How it works */}
          <div
            className="pt-8"
            style={{ borderTop: `1px solid ${tokens.borderSubtle}` }}
          >
            <p
              className="text-xs uppercase tracking-widest mb-6"
              style={{ color: tokens.textMuted }}
            >
              How it works
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
              {[
                { step: 1, text: "Paste job description", icon: Briefcase },
                { step: 2, text: "Upload candidates", icon: Users },
                { step: 3, text: "Run AI interviews", icon: Sparkles },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${tokens.brandPrimary}20, ${tokens.brandPrimary}10)`,
                      border: `1px solid ${tokens.brandPrimary}20`,
                    }}
                  >
                    <item.icon className="w-4 h-4" style={{ color: tokens.brandPrimary }} />
                  </div>
                  <span className="text-sm" style={{ color: tokens.textSecondary }}>
                    {item.text}
                  </span>
                  {i < 2 && (
                    <ChevronRight
                      className="w-4 h-4 hidden sm:block"
                      style={{ color: tokens.textDisabled }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================
export default function JobsPage() {
  const router = useRouter();
  const { recruiter } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: jobs = [],
    isLoading,
    error,
  } = useJobs(recruiter?.id, statusFilter !== "all" ? statusFilter : undefined);

  const deleteJobMutation = useDeleteJob();

  const handleDeleteJob = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      !confirm(
        "Are you sure you want to delete this job? This will also delete all candidates and analytics."
      )
    ) {
      return;
    }
    deleteJobMutation.mutate(jobId);
  };

  const filteredJobs = jobs.filter((job) =>
    job.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stats
  const activeJobs = jobs.filter((j) => j.status === "active").length;
  const totalCandidates = jobs.reduce((acc, j) => acc + j.candidate_count, 0);
  const totalInterviewed = jobs.reduce((acc, j) => acc + j.interviewed_count, 0);
  const needsAttention = jobs.filter(
    (j) =>
      j.status === "active" &&
      getPipelineHealth(j.interviewed_count, j.candidate_count) === "at_risk"
  ).length;

  const filterTabs = [
    { id: "all", label: "All", count: jobs.length },
    { id: "active", label: "Active", count: activeJobs },
    { id: "draft", label: "Draft", count: jobs.filter((j) => j.status === "draft").length },
    { id: "paused", label: "Paused", count: jobs.filter((j) => j.status === "paused").length },
    { id: "closed", label: "Closed", count: jobs.filter((j) => j.status === "closed").length },
  ];

  return (
    <AppLayout>
      {/* Page Canvas */}
      <div
        className="min-h-screen relative"
        style={{ backgroundColor: tokens.bgApp }}
      >
        {/* Ambient gradient */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse at 70% 10%, ${tokens.brandGlow} 0%, transparent 50%),
              radial-gradient(ellipse at 20% 80%, rgba(139,92,246,0.05) 0%, transparent 50%)
            `,
          }}
        />

        {/* Grain texture */}
        <div
          className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-30"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative px-8 py-8 max-w-[1400px] mx-auto"
        >
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeOutCustom }}
            className="flex items-start justify-between mb-8"
          >
            <div>
              <h1
                className="text-3xl font-bold tracking-tight mb-2"
                style={{ color: tokens.textPrimary }}
              >
                Jobs
              </h1>
              <p className="text-sm" style={{ color: tokens.textSecondary }}>
                Monitor hiring momentum across all your open positions
              </p>
            </div>
            <Button
              onClick={() => router.push("/jobs/new")}
              leftIcon={<Plus className="w-4 h-4" />}
              size="lg"
            >
              Create Job
            </Button>
          </motion.div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={Briefcase}
              value={activeJobs}
              label="Active Jobs"
              trend={{ value: 12, isPositive: true }}
              delay={0.1}
            />
            <StatCard
              icon={Users}
              value={totalCandidates}
              label="Total Candidates"
              variant="success"
              delay={0.15}
            />
            <StatCard
              icon={CheckCircle}
              value={totalInterviewed}
              label="Interviewed"
              delay={0.2}
            />
            <StatCard
              icon={AlertTriangle}
              value={needsAttention}
              label="Needs Attention"
              variant={needsAttention > 0 ? "danger" : "default"}
              delay={0.25}
            />
          </div>

          {/* Command Bar */}
          <CommandBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            filterTabs={filterTabs}
          />

          {/* Jobs List */}
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {[1, 2, 3].map((i) => (
                  <SkeletonCard key={i} />
                ))}
              </motion.div>
            ) : error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center py-16 rounded-2xl"
                style={{
                  backgroundColor: tokens.bgSurface,
                  border: `1px solid ${tokens.borderDefault}`,
                }}
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: "rgba(239,68,68,0.1)" }}
                >
                  <X className="w-8 h-8" style={{ color: tokens.statusDanger }} />
                </div>
                <h3
                  className="text-lg font-semibold mb-2"
                  style={{ color: tokens.textPrimary }}
                >
                  Failed to load jobs
                </h3>
                <p className="mb-6" style={{ color: tokens.textSecondary }}>
                  Something went wrong. Please try again.
                </p>
                <Button variant="secondary" onClick={() => window.location.reload()}>
                  Retry
                </Button>
              </motion.div>
            ) : filteredJobs.length === 0 ? (
              <EmptyState
                searchQuery={searchQuery}
                onCreateJob={() => router.push("/jobs/new")}
                onVoiceSetup={() => router.push("/jobs/new?voice=true")}
              />
            ) : (
              <motion.div
                key="jobs-list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {filteredJobs.map((job, index) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onDelete={handleDeleteJob}
                    isDeleting={deleteJobMutation.isPending}
                    onClick={() => router.push(`/jobs/${job.id}`)}
                    index={index}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AppLayout>
  );
}
