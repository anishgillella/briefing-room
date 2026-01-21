"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import {
  useScheduledInterviews,
  useInterviewers,
  useJobs,
  useCancelInterview,
} from "@/hooks/useApi";
import { formatDateTime } from "@/lib/schedulingApi";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Calendar,
  Clock,
  Search,
  Filter,
  Briefcase,
  ChevronRight,
  X,
  Play,
  XCircle,
  CheckCircle,
  RefreshCw,
  Video,
  UserCheck,
  Star,
  TrendingUp,
  Users,
  Command,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SkeletonCard } from "@/components/ui/skeleton";
import StartInterviewModal from "@/components/StartInterviewModal";
import {
  tokens,
  springConfig,
  easeOutCustom,
  statCardVariants,
  statusBadgeConfig,
  getScoreColor,
  ambientGradient,
  grainTexture,
} from "@/lib/design-tokens";

interface Interviewer {
  id: string;
  name: string;
  email: string;
}

interface Job {
  id: string;
  title: string;
}

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_ICONS: Record<string, React.ReactNode> = {
  scheduled: <Clock className="w-3 h-3" />,
  in_progress: <Play className="w-3 h-3" />,
  completed: <CheckCircle className="w-3 h-3" />,
  cancelled: <XCircle className="w-3 h-3" />,
};

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
  value: number | string;
  label: string;
  trend?: { value: number; isPositive: boolean };
  variant?: "default" | "success" | "warning" | "danger" | "info";
  delay?: number;
}) {
  const styles = statCardVariants[variant];

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
      <div
        className="relative p-5 rounded-2xl transition-all duration-300"
        style={{
          backgroundColor: tokens.bgSurface,
          border: `1px solid ${tokens.borderDefault}`,
          boxShadow: styles.glow,
        }}
      >
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
// COMMAND BAR
// =============================================================================
function CommandBar({
  searchQuery,
  setSearchQuery,
  activeFilterCount,
  showFilters,
  setShowFilters,
  onRefresh,
  total,
}: {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeFilterCount: number;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  onRefresh: () => void;
  total: number;
}) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("interview-search")?.focus();
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
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200"
              style={{ color: isSearchFocused ? tokens.textSecondary : tokens.textMuted }}
            />
            <input
              id="interview-search"
              type="text"
              placeholder="Search by candidate, interviewer, or job..."
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

          <div
            className="hidden sm:block w-px h-8"
            style={{ backgroundColor: tokens.borderSubtle }}
          />

          {/* Filter Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
            style={{
              backgroundColor: showFilters || activeFilterCount > 0
                ? "rgba(255,255,255,0.08)"
                : "transparent",
              color: showFilters || activeFilterCount > 0
                ? tokens.textPrimary
                : tokens.textMuted,
            }}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span
                className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full"
                style={{
                  backgroundColor: tokens.brandGlow,
                  color: tokens.brandPrimary,
                }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
            style={{ color: tokens.textMuted }}
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>

          {/* Results count */}
          <span className="text-sm" style={{ color: tokens.textMuted }}>
            {total} interviews
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// INTERVIEW CARD - Premium Design
// =============================================================================
function InterviewCard({
  interview,
  index,
  onStart,
  onCancel,
  onClick,
}: {
  interview: any;
  index: number;
  onStart: () => void;
  onCancel: () => void;
  onClick: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const statusStyle = statusBadgeConfig[interview.status] || statusBadgeConfig.scheduled;

  const canStart =
    (interview.status === "scheduled" || interview.status === "active" || interview.status === "in_progress") &&
    interview.candidate_id;
  const isUpcoming = interview.status === "scheduled" && interview.scheduled_at;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.06,
        ease: easeOutCustom,
      }}
      whileHover={!shouldReduceMotion ? { y: -2 } : {}}
      className="group relative cursor-pointer"
      onClick={onClick}
    >
      <div
        className="relative rounded-2xl p-5 transition-all duration-300 overflow-hidden"
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

        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            {/* Left: Interview Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                {/* Status Badge */}
                <span
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: statusStyle.bg,
                    color: statusStyle.text,
                  }}
                >
                  {STATUS_ICONS[interview.status]}
                  {interview.status.replace("_", " ")}
                </span>
                {/* Stage Badge */}
                <span
                  className="px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.05)",
                    color: tokens.textSecondary,
                    border: `1px solid ${tokens.borderSubtle}`,
                  }}
                >
                  {interview.stage?.replace("_", " ") || "Interview"}
                </span>
              </div>

              {/* Candidate Name */}
              <h3
                className="text-lg font-semibold mb-1 group-hover:text-indigo-400 transition-colors"
                style={{ color: tokens.textPrimary }}
              >
                {interview.candidate_name || "Unknown Candidate"}
              </h3>

              {/* Meta Info */}
              <div className="flex items-center gap-4 text-sm" style={{ color: tokens.textMuted }}>
                {interview.job_title && (
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5" />
                    {interview.job_title}
                  </span>
                )}
                {interview.interviewer_name && (
                  <span className="flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5" />
                    {interview.interviewer_name}
                  </span>
                )}
                {interview.duration_minutes && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {interview.duration_minutes} min
                  </span>
                )}
              </div>

              {/* Scheduled Time */}
              {interview.scheduled_at && (
                <div className="flex items-center gap-2 mt-3 text-sm" style={{ color: tokens.textSecondary }}>
                  <Calendar className="w-4 h-4" />
                  <span>
                    {formatDateTime(interview.scheduled_at, interview.timezone)}
                  </span>
                </div>
              )}

              {/* Notes */}
              {interview.notes && (
                <p
                  className="text-sm mt-2 line-clamp-1"
                  style={{ color: tokens.textMuted }}
                >
                  {interview.notes}
                </p>
              )}

              {/* Cancel Reason */}
              {interview.cancel_reason && (
                <p className="text-sm mt-2" style={{ color: tokens.statusDanger }}>
                  Cancelled: {interview.cancel_reason}
                </p>
              )}

              {/* Scores Display */}
              {interview.scores && interview.scores.has_completed_interviews && (
                <div
                  className="flex items-center gap-4 mt-3 pt-3 text-sm"
                  style={{ borderTop: `1px solid ${tokens.borderSubtle}` }}
                >
                  <div className="flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5" style={{ color: tokens.statusWarning }} />
                    <span style={{ color: tokens.textMuted }}>Scores:</span>
                  </div>
                  {interview.scores.round_1 !== null && (
                    <span className="font-medium" style={{ color: getScoreColor(interview.scores.round_1) }}>
                      R1: {interview.scores.round_1}
                    </span>
                  )}
                  {interview.scores.round_2 !== null && (
                    <span className="font-medium" style={{ color: getScoreColor(interview.scores.round_2) }}>
                      R2: {interview.scores.round_2}
                    </span>
                  )}
                  {interview.scores.round_3 !== null && (
                    <span className="font-medium" style={{ color: getScoreColor(interview.scores.round_3) }}>
                      R3: {interview.scores.round_3}
                    </span>
                  )}
                  {interview.scores.cumulative !== null && (
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" style={{ color: tokens.brandPrimary }} />
                      <span className="font-semibold" style={{ color: getScoreColor(interview.scores.cumulative) }}>
                        {interview.scores.cumulative}
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {canStart && (
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Video className="w-4 h-4" />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStart();
                  }}
                >
                  {interview.status === "scheduled" ? "Start" : "Join"}
                </Button>
              )}
              {isUpcoming && (
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<XCircle className="w-4 h-4" />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancel();
                  }}
                  className="text-red-400 hover:text-red-300"
                >
                  Cancel
                </Button>
              )}
              {interview.status === "completed" && (
                <ChevronRight
                  className="w-5 h-5 transition-all duration-200 group-hover:translate-x-1"
                  style={{ color: tokens.textMuted }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// EMPTY STATE
// =============================================================================
function EmptyState({ hasFilters }: { hasFilters: boolean }) {
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
          <Calendar className="w-16 h-16" style={{ color: tokens.brandPrimary }} />
        </motion.div>
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
        {hasFilters ? "No interviews found" : "No interviews scheduled"}
      </h3>
      <p
        className="text-base mb-8 max-w-md mx-auto"
        style={{ color: tokens.textSecondary }}
      >
        {hasFilters
          ? "Try adjusting your filters to find interviews."
          : "Schedule interviews with candidates to see them here."}
      </p>
    </motion.div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================
export default function InterviewsPage() {
  const router = useRouter();
  const { recruiter } = useAuth();
  const shouldReduceMotion = useReducedMotion();

  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedInterviewer, setSelectedInterviewer] = useState("");
  const [selectedJob, setSelectedJob] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Modals
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Start interview modal
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [selectedInterviewForStart, setSelectedInterviewForStart] = useState<{
    candidateId: string;
    candidateName: string;
    jobTitle: string;
  } | null>(null);

  // React Query hooks
  const {
    data: interviews = [],
    isLoading,
    refetch,
  } = useScheduledInterviews({
    interviewerId: selectedInterviewer || undefined,
    jobId: selectedJob || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    status: selectedStatus || undefined,
  });

  const { data: interviewers = [] } = useInterviewers();
  const { data: jobs = [] } = useJobs(recruiter?.id);

  const cancelInterviewMutation = useCancelInterview();

  const handleCancelInterview = async () => {
    if (!cancellingId) return;
    try {
      await cancelInterviewMutation.mutateAsync({
        interviewId: cancellingId,
        reason: cancelReason || undefined,
      });
      setCancelModalOpen(false);
      setCancellingId(null);
      setCancelReason("");
    } catch (error) {
      console.error("Failed to cancel interview:", error);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedStatus("");
    setSelectedInterviewer("");
    setSelectedJob("");
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters =
    selectedStatus || selectedInterviewer || selectedJob || dateFrom || dateTo;

  const activeFilterCount =
    (selectedStatus ? 1 : 0) +
    (selectedInterviewer ? 1 : 0) +
    (selectedJob ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  // Filter interviews by search query (client-side)
  const filteredInterviews = interviews.filter((interview: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      interview.candidate_name?.toLowerCase().includes(query) ||
      interview.interviewer_name?.toLowerCase().includes(query) ||
      interview.job_title?.toLowerCase().includes(query) ||
      interview.stage?.toLowerCase().includes(query)
    );
  });

  // Stats
  const totalInterviews = filteredInterviews.length;
  const completedInterviews = filteredInterviews.filter((i: any) => i.status === "completed").length;
  const upcomingInterviews = filteredInterviews.filter((i: any) => i.status === "scheduled").length;
  const avgScore = filteredInterviews
    .filter((i: any) => i.scores?.cumulative !== null && i.scores?.cumulative !== undefined)
    .reduce((acc: number, i: any, _, arr) => acc + (i.scores.cumulative / arr.length), 0);

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
          style={{ background: ambientGradient }}
        />

        {/* Grain texture */}
        <div
          className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-30"
          style={{ backgroundImage: grainTexture }}
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
                Interviews
              </h1>
              <p className="text-sm" style={{ color: tokens.textSecondary }}>
                Manage and track all candidate interviews
              </p>
            </div>
          </motion.div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={Calendar}
              value={totalInterviews}
              label="Total Interviews"
              delay={0.1}
            />
            <StatCard
              icon={CheckCircle}
              value={completedInterviews}
              label="Completed"
              variant="success"
              delay={0.15}
            />
            <StatCard
              icon={Clock}
              value={upcomingInterviews}
              label="Upcoming"
              variant="info"
              delay={0.2}
            />
            <StatCard
              icon={Star}
              value={avgScore > 0 ? Math.round(avgScore) : "—"}
              label="Average Score"
              variant={avgScore >= 70 ? "success" : avgScore >= 50 ? "warning" : "default"}
              delay={0.25}
            />
          </div>

          {/* Command Bar */}
          <CommandBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            activeFilterCount={activeFilterCount}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            onRefresh={() => refetch()}
            total={totalInterviews}
          />

          {/* Filter Panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mb-6"
              >
                <div
                  className="p-6 rounded-2xl space-y-6"
                  style={{
                    backgroundColor: tokens.bgSurface,
                    border: `1px solid ${tokens.borderDefault}`,
                  }}
                >
                  {/* Active Filters */}
                  {hasActiveFilters && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm" style={{ color: tokens.textMuted }}>
                        Active filters:
                      </span>
                      {selectedStatus && (
                        <button
                          onClick={() => setSelectedStatus("")}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                          style={{
                            backgroundColor: "rgba(59,130,246,0.2)",
                            border: "1px solid rgba(59,130,246,0.3)",
                            color: tokens.statusInfo,
                          }}
                        >
                          {STATUS_OPTIONS.find((s) => s.value === selectedStatus)?.label}
                          <X className="w-3 h-3" />
                        </button>
                      )}
                      {selectedInterviewer && (
                        <button
                          onClick={() => setSelectedInterviewer("")}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                          style={{
                            backgroundColor: "rgba(139,92,246,0.2)",
                            border: "1px solid rgba(139,92,246,0.3)",
                            color: "#A78BFA",
                          }}
                        >
                          <UserCheck className="w-3 h-3" />
                          {(interviewers as Interviewer[]).find((i) => i.id === selectedInterviewer)?.name || "Interviewer"}
                          <X className="w-3 h-3" />
                        </button>
                      )}
                      {selectedJob && (
                        <button
                          onClick={() => setSelectedJob("")}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                          style={{
                            backgroundColor: "rgba(245,158,11,0.2)",
                            border: "1px solid rgba(245,158,11,0.3)",
                            color: tokens.statusWarning,
                          }}
                        >
                          <Briefcase className="w-3 h-3" />
                          {(jobs as Job[]).find((j) => j.id === selectedJob)?.title || "Job"}
                          <X className="w-3 h-3" />
                        </button>
                      )}
                      {dateFrom && (
                        <button
                          onClick={() => setDateFrom("")}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                          style={{
                            backgroundColor: "rgba(16,185,129,0.2)",
                            border: "1px solid rgba(16,185,129,0.3)",
                            color: tokens.statusSuccess,
                          }}
                        >
                          <Calendar className="w-3 h-3" />
                          From: {dateFrom}
                          <X className="w-3 h-3" />
                        </button>
                      )}
                      {dateTo && (
                        <button
                          onClick={() => setDateTo("")}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                          style={{
                            backgroundColor: "rgba(16,185,129,0.2)",
                            border: "1px solid rgba(16,185,129,0.3)",
                            color: tokens.statusSuccess,
                          }}
                        >
                          <Calendar className="w-3 h-3" />
                          To: {dateTo}
                          <X className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={clearFilters}
                        className="text-xs underline ml-2 transition-colors"
                        style={{ color: tokens.textMuted }}
                      >
                        Clear all
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Status Filter */}
                    <div>
                      <label className="text-sm mb-2 block" style={{ color: tokens.textMuted }}>
                        Status
                      </label>
                      <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        className="w-full rounded-xl px-4 py-2.5 text-sm transition-all outline-none"
                        style={{
                          backgroundColor: "rgba(255,255,255,0.05)",
                          border: `1px solid ${tokens.borderDefault}`,
                          color: tokens.textPrimary,
                        }}
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Interviewer Filter */}
                    <div>
                      <label className="text-sm mb-2 block" style={{ color: tokens.textMuted }}>
                        Interviewer
                      </label>
                      <select
                        value={selectedInterviewer}
                        onChange={(e) => setSelectedInterviewer(e.target.value)}
                        className="w-full rounded-xl px-4 py-2.5 text-sm transition-all outline-none"
                        style={{
                          backgroundColor: "rgba(255,255,255,0.05)",
                          border: `1px solid ${tokens.borderDefault}`,
                          color: tokens.textPrimary,
                        }}
                      >
                        <option value="">All Interviewers</option>
                        {(interviewers as Interviewer[]).map((interviewer) => (
                          <option key={interviewer.id} value={interviewer.id}>
                            {interviewer.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Job Filter */}
                    <div>
                      <label className="text-sm mb-2 block" style={{ color: tokens.textMuted }}>
                        Job Position
                      </label>
                      <select
                        value={selectedJob}
                        onChange={(e) => setSelectedJob(e.target.value)}
                        className="w-full rounded-xl px-4 py-2.5 text-sm transition-all outline-none"
                        style={{
                          backgroundColor: "rgba(255,255,255,0.05)",
                          border: `1px solid ${tokens.borderDefault}`,
                          color: tokens.textPrimary,
                        }}
                      >
                        <option value="">All Jobs</option>
                        {(jobs as Job[]).map((job) => (
                          <option key={job.id} value={job.id}>
                            {job.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Date From */}
                    <div>
                      <label className="text-sm mb-2 block" style={{ color: tokens.textMuted }}>
                        From Date
                      </label>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-full rounded-xl px-4 py-2.5 text-sm transition-all outline-none"
                        style={{
                          backgroundColor: "rgba(255,255,255,0.05)",
                          border: `1px solid ${tokens.borderDefault}`,
                          color: tokens.textPrimary,
                        }}
                      />
                    </div>

                    {/* Date To */}
                    <div>
                      <label className="text-sm mb-2 block" style={{ color: tokens.textMuted }}>
                        To Date
                      </label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-full rounded-xl px-4 py-2.5 text-sm transition-all outline-none"
                        style={{
                          backgroundColor: "rgba(255,255,255,0.05)",
                          border: `1px solid ${tokens.borderDefault}`,
                          color: tokens.textPrimary,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results */}
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
            ) : filteredInterviews.length === 0 ? (
              <EmptyState hasFilters={hasActiveFilters || !!searchQuery} />
            ) : (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {filteredInterviews.map((interview: any, index: number) => (
                  <InterviewCard
                    key={interview.id}
                    interview={interview}
                    index={index}
                    onStart={() => {
                      setSelectedInterviewForStart({
                        candidateId: interview.candidate_id,
                        candidateName: interview.candidate_name || "Unknown Candidate",
                        jobTitle: interview.job_title || "",
                      });
                      setStartModalOpen(true);
                    }}
                    onCancel={() => {
                      setCancellingId(interview.id);
                      setCancelModalOpen(true);
                    }}
                    onClick={() => router.push(`/candidates/${interview.candidate_id}`)}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Cancel Modal */}
      <AnimatePresence>
        {cancelModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-6 rounded-2xl max-w-md w-full mx-4"
              style={{
                backgroundColor: tokens.bgSurface,
                border: `1px solid ${tokens.borderDefault}`,
              }}
            >
              <h3 className="text-lg font-semibold mb-4" style={{ color: tokens.textPrimary }}>
                Cancel Interview
              </h3>
              <p className="text-sm mb-4" style={{ color: tokens.textSecondary }}>
                Are you sure you want to cancel this interview? This action cannot be undone.
              </p>
              <div className="mb-4">
                <label className="text-sm mb-2 block" style={{ color: tokens.textMuted }}>
                  Reason (optional)
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Enter cancellation reason..."
                  rows={3}
                  className="w-full rounded-xl px-4 py-3 text-sm transition-all outline-none resize-none"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.05)",
                    border: `1px solid ${tokens.borderDefault}`,
                    color: tokens.textPrimary,
                  }}
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => {
                    setCancelModalOpen(false);
                    setCancellingId(null);
                    setCancelReason("");
                  }}
                >
                  Keep Interview
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1 text-red-400"
                  onClick={handleCancelInterview}
                  disabled={cancelInterviewMutation.isPending}
                >
                  {cancelInterviewMutation.isPending ? "Cancelling..." : "Cancel Interview"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Start Interview Modal */}
      <StartInterviewModal
        isOpen={startModalOpen}
        onClose={() => {
          setStartModalOpen(false);
          setSelectedInterviewForStart(null);
        }}
        candidateId={selectedInterviewForStart?.candidateId || ""}
        candidateName={selectedInterviewForStart?.candidateName || ""}
        jobTitle={selectedInterviewForStart?.jobTitle || ""}
      />
    </AppLayout>
  );
}
