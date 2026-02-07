"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import {
  useScheduledInterviews,
  useInterviewers,
  useJobs,
  useCancelInterview,
} from "@/hooks/useApi";
import { formatDateTime } from "@/lib/schedulingApi";
import {
  Calendar,
  Clock,
  Search,
  Filter,
  Briefcase,
  ChevronRight,
  ChevronDown,
  X,
  Play,
  XCircle,
  CheckCircle,
  RefreshCw,
  Video,
  UserCheck,
  Loader2,
  Star,
  TrendingUp,
  Command,
  Zap,
  AlertCircle,
  CalendarCheck,
  CalendarX,
  ArrowRight,
  User,
  Eye,
  Bot,
  Phone,
  Building2,
  FileText,
  MessageSquare,
  BarChart2,
  LayoutGrid,
  List,

} from "lucide-react";
import StartInterviewModal from "@/components/StartInterviewModal";
import ScheduleInterviewModal from "@/components/ScheduleInterviewModal";
import { tokens, springConfig, easeOutCustom } from "@/lib/design-tokens";

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

interface Interviewer {
  id: string;
  name: string;
  email: string;
}

interface Job {
  id: string;
  title: string;
  interview_stage_icons?: string[];
}

interface Interview {
  id: string;
  candidate_id: string;
  candidate_name?: string;
  interviewer_name?: string;
  job_title?: string;
  job_posting_id?: string;
  stage?: string;
  status: string;
  scheduled_at?: string;
  timezone?: string;
  duration_minutes?: number;
  notes?: string;
  cancel_reason?: string;
  scores?: {
    has_completed_interviews: boolean;
    round_1: number | null;
    round_2: number | null;
    round_3: number | null;
    cumulative: number | null;
  };
  analytics?: any[];
  transcripts?: any[];
  ended_at?: string;
}

// Grouped candidate with all their interview rounds
interface GroupedCandidate {
  candidate_id: string;
  candidate_name: string;
  job_title: string;
  job_id?: string;
  interviews: Interview[];
  rounds: {
    round_1: Interview | null;
    round_2: Interview | null;
    round_3: Interview | null;
  };
  scores: {
    round_1: number | null;
    round_2: number | null;
    round_3: number | null;
    average: number | null;
  };
  nextInterview: Interview | null;
  overallStatus: "not_started" | "in_progress" | "completed" | "cancelled";
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STATUS_TABS = [
  { value: "", label: "All", icon: Calendar },
  { value: "scheduled", label: "Scheduled", icon: Clock },
  { value: "in_progress", label: "In Progress", icon: Play },
  { value: "completed", label: "Completed", icon: CheckCircle },
  { value: "cancelled", label: "Cancelled", icon: XCircle },
];

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  scheduled: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/20",
    dot: "bg-blue-400",
  },
  in_progress: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
    dot: "bg-amber-400",
  },
  active: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
    dot: "bg-amber-400",
  },
  completed: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
    dot: "bg-emerald-400",
  },
  cancelled: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/20",
    dot: "bg-red-400",
  },
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  scheduled: <Clock className="w-3 h-3" />,
  in_progress: <Play className="w-3 h-3" />,
  active: <Play className="w-3 h-3" />,
  completed: <CheckCircle className="w-3 h-3" />,
  cancelled: <XCircle className="w-3 h-3" />,
};

const STAGE_ICON_MAP: Record<string, any> = {
  bot: Bot,
  phone: Phone,
  video: Video,
  building: Building2,
  users: User,
  mic: Zap,
  file: FileText,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getStageIcon(iconName?: string) {
  if (!iconName) return Video;
  return STAGE_ICON_MAP[iconName.toLowerCase()] || Video;
}

function getScoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return tokens.textMuted;
  if (score >= 80) return tokens.statusSuccess;
  if (score >= 60) return tokens.statusWarning;
  return tokens.statusDanger;
}

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

function isThisWeek(date: Date): boolean {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  return date >= startOfWeek && date < endOfWeek;
}

function parseRoundFromStage(stage?: string): number | null {
  if (!stage) return null;
  const stageLower = stage.toLowerCase();
  if (stageLower.includes("round_1") || stageLower.includes("round 1") || stageLower === "r1") return 1;
  if (stageLower.includes("round_2") || stageLower.includes("round 2") || stageLower === "r2") return 2;
  if (stageLower.includes("round_3") || stageLower.includes("round 3") || stageLower === "r3") return 3;
  // Try to extract number from stage_X format
  const match = stage.match(/stage_?(\d+)/i) || stage.match(/round_?(\d+)/i);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= 3) return num;
  }
  return null;
}

function groupInterviewsByCandidate(interviews: Interview[]): GroupedCandidate[] {
  const candidateMap = new Map<string, GroupedCandidate>();

  interviews.forEach((interview) => {
    const candidateId = interview.candidate_id;
    if (!candidateId) return;

    if (!candidateMap.has(candidateId)) {
      candidateMap.set(candidateId, {
        candidate_id: candidateId,
        candidate_name: interview.candidate_name || "Unknown Candidate",
        job_title: interview.job_title || "",
        job_id: interview.job_posting_id,
        interviews: [],
        rounds: { round_1: null, round_2: null, round_3: null },
        scores: { round_1: null, round_2: null, round_3: null, average: null },
        nextInterview: null,
        overallStatus: "not_started",
      });
    }

    const group = candidateMap.get(candidateId)!;
    group.interviews.push(interview);

    // Assign to round slot
    const roundNum = parseRoundFromStage(interview.stage);
    if (roundNum === 1) group.rounds.round_1 = interview;
    else if (roundNum === 2) group.rounds.round_2 = interview;
    else if (roundNum === 3) group.rounds.round_3 = interview;

    // Extract scores
    if (interview.scores) {
      if (interview.scores.round_1 !== null) group.scores.round_1 = interview.scores.round_1;
      if (interview.scores.round_2 !== null) group.scores.round_2 = interview.scores.round_2;
      if (interview.scores.round_3 !== null) group.scores.round_3 = interview.scores.round_3;
    }
  });

  // Post-process each group
  candidateMap.forEach((group) => {
    // Calculate average score
    const validScores = [group.scores.round_1, group.scores.round_2, group.scores.round_3].filter(
      (s): s is number => s !== null
    );
    group.scores.average = validScores.length > 0
      ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
      : null;

    // Find next upcoming interview
    const upcomingInterviews = group.interviews
      .filter((i) => i.status === "scheduled" && i.scheduled_at)
      .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());
    group.nextInterview = upcomingInterviews[0] || null;

    // Determine overall status
    const hasCompleted = group.interviews.some((i) => i.status === "completed");
    const hasScheduled = group.interviews.some((i) => i.status === "scheduled");
    const hasInProgress = group.interviews.some((i) => i.status === "in_progress" || i.status === "active");
    const allCancelled = group.interviews.every((i) => i.status === "cancelled");

    if (allCancelled) {
      group.overallStatus = "cancelled";
    } else if (hasInProgress) {
      group.overallStatus = "in_progress";
    } else if (hasCompleted && !hasScheduled) {
      group.overallStatus = "completed";
    } else if (hasCompleted || hasScheduled) {
      group.overallStatus = "in_progress";
    } else {
      group.overallStatus = "not_started";
    }
  });

  // Sort by next interview date, then by name
  return Array.from(candidateMap.values()).sort((a, b) => {
    // Prioritize candidates with upcoming interviews
    if (a.nextInterview && !b.nextInterview) return -1;
    if (!a.nextInterview && b.nextInterview) return 1;
    if (a.nextInterview && b.nextInterview) {
      return new Date(a.nextInterview.scheduled_at!).getTime() -
        new Date(b.nextInterview.scheduled_at!).getTime();
    }
    return a.candidate_name.localeCompare(b.candidate_name);
  });
}

// =============================================================================
// STAT CARD COMPONENT
// =============================================================================

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  delay?: number;
}

function StatCard({ label, value, icon, color, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springConfig, delay }}
      className="relative overflow-hidden rounded-2xl border"
      style={{
        backgroundColor: tokens.bgCard,
        borderColor: tokens.borderSubtle,
      }}
    >
      {/* Subtle glow effect */}
      <div
        className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-20 blur-3xl"
        style={{ backgroundColor: color }}
      />

      <div className="relative p-5">
        <div className="flex items-center justify-between mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${color}15` }}
          >
            <div style={{ color }}>{icon}</div>
          </div>
        </div>
        <div className="text-3xl font-light tracking-tight text-white mb-1">
          {value}
        </div>
        <div className="text-sm" style={{ color: tokens.textMuted }}>
          {label}
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// COMMAND BAR COMPONENT
// =============================================================================

interface CommandBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function CommandBar({ value, onChange, placeholder }: CommandBarProps) {
  const [isFocused, setIsFocused] = useState(false);

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
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springConfig}
      className={`relative rounded-2xl border transition-all duration-300 ${isFocused ? "ring-2 ring-indigo-500/20" : ""
        }`}
      style={{
        backgroundColor: tokens.bgSurface,
        borderColor: isFocused ? tokens.brandPrimary + "40" : tokens.borderSubtle,
      }}
    >
      <div className="flex items-center px-4 py-3">
        <Search className="w-5 h-5 mr-3" style={{ color: tokens.textMuted }} />
        <input
          id="interview-search"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder || "Search interviews..."}
          className="flex-1 bg-transparent text-white placeholder:text-white/30 focus:outline-none text-sm"
        />
        <div
          className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
          style={{
            backgroundColor: tokens.bgCard,
            color: tokens.textMuted,
          }}
        >
          <Command className="w-3 h-3" />
          <span>K</span>
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// INTERVIEW CARD COMPONENT
// =============================================================================

interface InterviewCardProps {
  interview: Interview;
  onStart: () => void;
  onCancel: () => void;
  onClick: () => void;
  index: number;
}

function InterviewCard({ interview, onStart, onCancel, onClick, index }: InterviewCardProps) {
  const statusStyle = STATUS_STYLES[interview.status] || STATUS_STYLES.scheduled;
  const canStart =
    (interview.status === "scheduled" ||
      interview.status === "active" ||
      interview.status === "in_progress") &&
    interview.candidate_id;
  const isUpcoming = interview.status === "scheduled" && interview.scheduled_at;
  const scheduledDate = interview.scheduled_at ? new Date(interview.scheduled_at) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springConfig, delay: index * 0.03 }}
      onClick={onClick}
      className="group relative rounded-2xl border cursor-pointer transition-all duration-300 hover:border-white/20"
      style={{
        backgroundColor: tokens.bgCard,
        borderColor: tokens.borderSubtle,
      }}
    >
      {/* Hover glow */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), ${tokens.brandPrimary}08, transparent 40%)`,
        }}
      />

      <div className="relative p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Interview Details */}
          <div className="flex-1 min-w-0">
            {/* Status & Stage Badges */}
            <div className="flex items-center gap-2 mb-3">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                {interview.status.replace("_", " ")}
              </span>
              {interview.stage && (
                <span
                  className="px-2.5 py-1 rounded-lg text-xs border"
                  style={{
                    backgroundColor: tokens.bgSurface,
                    borderColor: tokens.borderSubtle,
                    color: tokens.textSecondary,
                  }}
                >
                  {interview.stage.replace("_", " ")}
                </span>
              )}
              {scheduledDate && isToday(scheduledDate) && (
                <span className="px-2.5 py-1 rounded-lg text-xs bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  Today
                </span>
              )}
            </div>

            {/* Candidate Name */}
            <h3 className="text-lg font-medium text-white mb-2 group-hover:text-indigo-300 transition-colors">
              {interview.candidate_name || "Unknown Candidate"}
            </h3>

            {/* Meta Info */}
            <div className="flex flex-wrap items-center gap-4 text-sm" style={{ color: tokens.textMuted }}>
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
            {scheduledDate && (
              <div className="flex items-center gap-2 mt-3 text-sm">
                <Calendar className="w-4 h-4" style={{ color: tokens.textMuted }} />
                <span style={{ color: tokens.textSecondary }}>
                  {formatDateTime(interview.scheduled_at!, interview.timezone)}
                </span>
              </div>
            )}

            {/* Notes */}
            {interview.notes && (
              <p className="text-sm mt-2 line-clamp-1" style={{ color: tokens.textMuted }}>
                {interview.notes}
              </p>
            )}

            {/* Cancel Reason */}
            {interview.cancel_reason && (
              <p className="text-sm mt-2" style={{ color: `${tokens.statusDanger}90` }}>
                Cancelled: {interview.cancel_reason}
              </p>
            )}

            {/* Scores Display */}
            {interview.scores && (
              <div
                className="mt-4 pt-4 border-t"
                style={{ borderColor: tokens.borderSubtle }}
              >
                {interview.scores.has_completed_interviews ? (
                  <div className="flex items-center gap-4 text-sm">
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
                ) : (
                  <div className="flex items-center gap-2 text-sm" style={{ color: tokens.textMuted }}>
                    <Clock className="w-3.5 h-3.5" />
                    <span>Interviews pending</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {canStart && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStart();
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105"
                style={{
                  backgroundColor: `${tokens.brandPrimary}20`,
                  border: `1px solid ${tokens.brandPrimary}30`,
                  color: tokens.brandPrimary,
                }}
              >
                <Video className="w-4 h-4" />
                {interview.status === "scheduled" ? "Start" : "Join"}
              </button>
            )}
            {isUpcoming && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel();
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all duration-200 hover:scale-105"
                style={{
                  backgroundColor: `${tokens.statusDanger}10`,
                  border: `1px solid ${tokens.statusDanger}20`,
                  color: tokens.statusDanger,
                }}
              >
                <XCircle className="w-4 h-4" />
                Cancel
              </button>
            )}
            {interview.status === "completed" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClick();
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-colors"
                style={{
                  backgroundColor: tokens.bgSurface,
                  border: `1px solid ${tokens.borderSubtle}`,
                  color: tokens.textSecondary,
                }}
              >
                View Details
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// ANALYTICS MODAL COMPONENT
// =============================================================================

function AnalyticsModal({
  interview,
  onClose,
}: {
  interview: Interview;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "transcript">("overview");
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [transcriptTurns, setTranscriptTurns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

        // Fetch analytics and transcript in parallel
        const [analyticsRes, transcriptRes] = await Promise.all([
          fetch(`${API_URL}/api/interviews/candidate/${interview.candidate_id}`),
          fetch(`${API_URL}/api/interviews/${interview.id}/transcript`),
        ]);

        if (analyticsRes.ok) {
          const data = await analyticsRes.json();
          const match = data.interviews?.find((i: any) => i.id === interview.id || i.stage === interview.stage);
          if (match) {
            setAnalyticsData(match.analytics || null);
          }
        }

        if (transcriptRes.ok) {
          const tData = await transcriptRes.json();
          if (tData.transcript?.turns) {
            setTranscriptTurns(tData.transcript.turns);
          }
        }
      } catch (e) {
        console.error("Failed to fetch interview data:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [interview.candidate_id, interview.id, interview.stage]);

  const analytics = analyticsData || interview.analytics?.[0];
  const bp = analytics?.behavioral_profile;
  const cm = analytics?.communication_metrics;
  const topicsObj = analytics?.topics_to_probe;

  // Extract highlights and red flags from behavioral_profile (actual DB format)
  const bpHighlights: string[] = Array.isArray(bp?.highlights) ? bp.highlights : [];
  const bpRedFlags: string[] = Array.isArray(bp?.red_flags) ? bp.red_flags : [];
  // Also check topics_to_probe.overall for red flags/highlights
  const tpRedFlags: string[] = Array.isArray(topicsObj?.overall?.red_flags) ? topicsObj.overall.red_flags : [];
  const tpHighlights: string[] = Array.isArray(topicsObj?.overall?.highlights) ? topicsObj.overall.highlights : [];
  const allHighlights = [...new Set([...bpHighlights, ...tpHighlights])];
  const allRedFlags = [...new Set([...bpRedFlags, ...tpRedFlags])];

  // Score bars from behavioral_profile
  const scoreEntries: [string, number][] = [];
  if (bp?.technical_score != null) scoreEntries.push(["Technical", bp.technical_score]);
  if (bp?.cultural_fit_score != null) scoreEntries.push(["Cultural Fit", bp.cultural_fit_score]);
  if (bp?.communication_score != null) scoreEntries.push(["Communication", bp.communication_score]);

  // Areas to probe from communication_metrics
  const areasToProbe: string[] = Array.isArray(cm?.areas_to_probe) ? cm.areas_to_probe
    : Array.isArray(analytics?.skill_evidence) ? analytics.skill_evidence.filter((s: any) => typeof s === "string")
    : [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[90vh] rounded-2xl border overflow-hidden flex flex-col"
        style={{ backgroundColor: tokens.bgSurface, borderColor: tokens.borderSubtle }}
      >
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between" style={{ borderColor: tokens.borderSubtle }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-500/10">
              <Video className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {interview.stage ? interview.stage.replace("_", " ").toUpperCase() : "Interview"} Results
              </h3>
              <p className="text-sm" style={{ color: tokens.textMuted }}>
                {interview.candidate_name} • {formatDateTime(interview.ended_at || "", interview.timezone)}
              </p>
            </div>
            {analytics?.recommendation && (
              <span className={`ml-3 px-3 py-1 rounded-full text-xs font-bold uppercase ${
                analytics.recommendation.toLowerCase().includes("hire") && !analytics.recommendation.toLowerCase().includes("no")
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                  : "bg-red-500/15 text-red-400 border border-red-500/20"
              }`}>
                {analytics.recommendation}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5 text-white/50" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: tokens.borderSubtle }}>
          {(["overview", "transcript"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-white/50 hover:text-white/80"
              }`}
            >
              {tab === "overview" ? "Overview" : "Transcript"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              <span className="ml-2 text-sm" style={{ color: tokens.textMuted }}>Loading analytics...</span>
            </div>
          ) : activeTab === "overview" ? (
            <div className="space-y-6">
              {/* Score + Profile Scores */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border" style={{ backgroundColor: tokens.bgCard, borderColor: tokens.borderSubtle }}>
                  <div className="text-sm font-medium mb-1" style={{ color: tokens.textMuted }}>Overall Score</div>
                  <div className="text-4xl font-bold" style={{ color: getScoreColor(analytics?.overall_score) }}>
                    {analytics?.overall_score ?? "—"}<span className="text-lg text-white/30">/100</span>
                  </div>
                </div>
                {scoreEntries.map(([label, score]) => (
                  <div key={label} className="p-4 rounded-xl border" style={{ backgroundColor: tokens.bgCard, borderColor: tokens.borderSubtle }}>
                    <div className="text-sm font-medium mb-1" style={{ color: tokens.textMuted }}>{label}</div>
                    <div className="text-3xl font-bold" style={{ color: getScoreColor(score * 10) }}>
                      {score}<span className="text-base text-white/30">/10</span>
                    </div>
                  </div>
                ))}
                {bp?.confidence != null && (
                  <div className="p-4 rounded-xl border" style={{ backgroundColor: tokens.bgCard, borderColor: tokens.borderSubtle }}>
                    <div className="text-sm font-medium mb-1" style={{ color: tokens.textMuted }}>Confidence</div>
                    <div className="text-3xl font-bold" style={{ color: getScoreColor(bp.confidence) }}>
                      {bp.confidence}<span className="text-base text-white/30">%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Executive Summary */}
              <div className="p-4 rounded-xl border" style={{ backgroundColor: tokens.bgCard, borderColor: tokens.borderSubtle }}>
                <h4 className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: tokens.textSecondary }}>
                  Executive Summary
                </h4>
                <p className="text-sm leading-relaxed" style={{ color: tokens.textPrimary }}>
                  {analytics?.synthesis || analytics?.summary || analytics?.recommendation_reasoning || "No summary available."}
                </p>
              </div>

              {/* Highlights + Red Flags */}
              <div className="grid grid-cols-2 gap-4">
                {allHighlights.length > 0 && (
                  <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                    <h5 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3">
                      <CheckCircle className="w-3.5 h-3.5" /> Highlights
                    </h5>
                    <ul className="space-y-2">
                      {allHighlights.map((h, i) => (
                        <li key={i} className="text-xs text-emerald-200/80 flex items-start gap-2">
                          <span className="mt-1 w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
                          {h}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {allRedFlags.length > 0 && (
                  <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
                    <h5 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-400 mb-3">
                      <AlertCircle className="w-3.5 h-3.5" /> Red Flags
                    </h5>
                    <ul className="space-y-2">
                      {allRedFlags.map((f, i) => (
                        <li key={i} className="text-xs text-red-200/80 flex items-start gap-2">
                          <span className="mt-1 w-1 h-1 rounded-full bg-red-400 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Areas to Probe */}
              {areasToProbe.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                  <h5 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 mb-3">
                    <Search className="w-3.5 h-3.5" /> Areas to Probe Further
                  </h5>
                  <ul className="space-y-2">
                    {areasToProbe.map((topic, i) => (
                      <li key={i} className="text-xs text-amber-200/80 flex items-start gap-2">
                        <span className="mt-1 w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                        {topic}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Standout Moments from communication_metrics */}
              {Array.isArray(cm?.standout_moments) && cm.standout_moments.length > 0 && (
                <div className="p-4 rounded-xl border" style={{ backgroundColor: tokens.bgCard, borderColor: tokens.borderSubtle }}>
                  <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: tokens.textSecondary }}>
                    <Star className="w-4 h-4 text-yellow-400" /> Standout Moments
                  </h4>
                  <div className="space-y-3">
                    {cm.standout_moments.map((m: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
                        <div className="text-xs font-medium text-yellow-300 mb-1">{m.question}</div>
                        {m.quote && <div className="text-xs italic text-yellow-200/60 mb-1">&ldquo;{m.quote}&rdquo;</div>}
                        {m.why && <div className="text-xs text-white/40">{m.why}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Best Answer */}
              {cm?.best_answer && (
                <div className="p-4 rounded-xl border border-emerald-500/10 bg-emerald-500/5">
                  <h4 className="text-sm font-semibold uppercase tracking-wider mb-2 text-emerald-400">Best Answer</h4>
                  <p className="text-xs font-medium text-white/80 mb-1">{cm.best_answer.question}</p>
                  <p className="text-xs italic text-emerald-200/60 leading-relaxed">&ldquo;{cm.best_answer.quote}&rdquo;</p>
                  {cm.best_answer.why_impressive && <p className="text-xs mt-2 text-white/40">{cm.best_answer.why_impressive}</p>}
                </div>
              )}

              {/* Quotable Moments */}
              {Array.isArray(cm?.quotable_moments) && cm.quotable_moments.length > 0 && (
                <div className="p-4 rounded-xl border" style={{ backgroundColor: tokens.bgCard, borderColor: tokens.borderSubtle }}>
                  <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: tokens.textSecondary }}>
                    <MessageSquare className="w-4 h-4 text-indigo-400" /> Quotable Moments
                  </h4>
                  <div className="space-y-2">
                    {cm.quotable_moments.map((q: string, i: number) => (
                      <div key={i} className="text-xs italic text-white/50 pl-3 border-l-2 border-indigo-500/30">
                        &ldquo;{q}&rdquo;
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Question-by-Question Breakdown */}
              {Array.isArray(analytics?.question_analytics) && analytics.question_analytics.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: tokens.textSecondary }}>
                    Question-by-Question Breakdown
                  </h4>
                  <div className="space-y-3">
                    {analytics.question_analytics.map((qa: any, i: number) => {
                      const metrics = qa.metrics || {};
                      return (
                        <div key={i} className="p-4 rounded-xl border" style={{ backgroundColor: tokens.bgCard, borderColor: tokens.borderSubtle }}>
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <div className="flex-1">
                              {qa.question_type && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-medium uppercase">
                                  {qa.question_type}
                                </span>
                              )}
                              <p className="text-sm font-medium text-white mt-1.5">{qa.question}</p>
                            </div>
                            {(metrics.depth != null || metrics.clarity != null || metrics.relevance != null) && (
                              <div className="flex gap-2 shrink-0">
                                {metrics.relevance != null && <div className="text-center"><div className="text-lg font-bold" style={{ color: getScoreColor(metrics.relevance * 10) }}>{metrics.relevance}</div><div className="text-[9px] text-white/30">REL</div></div>}
                                {metrics.clarity != null && <div className="text-center"><div className="text-lg font-bold" style={{ color: getScoreColor(metrics.clarity * 10) }}>{metrics.clarity}</div><div className="text-[9px] text-white/30">CLR</div></div>}
                                {metrics.depth != null && <div className="text-center"><div className="text-lg font-bold" style={{ color: getScoreColor(metrics.depth * 10) }}>{metrics.depth}</div><div className="text-[9px] text-white/30">DPT</div></div>}
                              </div>
                            )}
                          </div>
                          {(qa.answer || qa.answer_summary) && (
                            <p className="text-xs leading-relaxed mb-2" style={{ color: tokens.textMuted }}>{qa.answer || qa.answer_summary}</p>
                          )}
                          {qa.highlight && (
                            <p className="text-xs italic text-indigo-300/60 mb-1">&ldquo;{qa.highlight}&rdquo;</p>
                          )}
                          {qa.concern && (
                            <p className="text-xs text-red-300/60"><span className="font-medium">Concern:</span> {qa.concern}</p>
                          )}
                          {qa.follow_up_needed && (
                            <p className="text-xs text-amber-300/60 mt-1"><span className="font-medium">Follow-up:</span> {qa.follow_up_needed}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

          ) : (
            /* Transcript Tab */
            <div className="space-y-3">
              {transcriptTurns.length > 0 ? (
                transcriptTurns.map((turn: any, i: number) => {
                  const isInterviewer = turn.speaker === "interviewer" || turn.role === "assistant" || turn.speaker === "ai";
                  return (
                    <div key={i} className={`flex ${isInterviewer ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[80%] rounded-2xl p-4 ${
                        isInterviewer
                          ? "bg-indigo-500/10 text-indigo-100 rounded-tl-sm"
                          : "bg-emerald-500/10 text-emerald-100 rounded-tr-sm"
                      }`}>
                        <div className="text-[10px] uppercase font-bold mb-1 opacity-50">
                          {isInterviewer ? "AI Interviewer" : "Candidate"}
                        </div>
                        <p className="text-sm leading-relaxed">{turn.text || turn.content || turn.message}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-white/30 italic">No transcript data available.</div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// =============================================================================
// ROUND BADGE COMPONENT (for timeline)
// =============================================================================

interface RoundBadgeProps {
  round: number;
  interview: Interview | null;
  score: number | null;
  icon?: any;
  onStart?: () => void;
  onCancel?: () => void;
  onClick?: () => void;
}

function RoundBadge({ round, interview, score, icon: Icon, onStart, onCancel, onClick }: RoundBadgeProps) {
  const getStatus = () => {
    if (!interview) return "pending";
    if (interview.status === "completed") return "completed";
    if (interview.status === "cancelled") return "cancelled";
    if (interview.status === "in_progress" || interview.status === "active") return "active";
    if (interview.status === "scheduled") {
      if (interview.scheduled_at && isToday(new Date(interview.scheduled_at))) return "today";
      return "scheduled";
    }
    return "pending";
  };

  const status = getStatus();
  const canStart = interview && (interview.status === "scheduled" || interview.status === "active" || interview.status === "in_progress");
  const canCancel = interview && interview.status === "scheduled";

  // Format scheduled date for display
  const getScheduledDateDisplay = () => {
    if (!interview?.scheduled_at) return null;
    const date = new Date(interview.scheduled_at);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (isToday(date)) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1) {
      return "Tomorrow";
    }
    if (diffDays > 0 && diffDays <= 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // COMPLETED ROUND - Solid filled, prominent score (clean design)
  if (status === "completed") {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        transition={{ ...springConfig, delay: round * 0.1 }}
        className="flex flex-col items-center cursor-pointer group"
      >
        <div
          className="w-24 h-24 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 group-hover:shadow-lg group-hover:shadow-emerald-500/20"
          style={{
            background: `linear-gradient(135deg, ${tokens.statusSuccess}25 0%, ${tokens.statusSuccess}15 100%)`,
            border: `2px solid ${tokens.statusSuccess}`,
            boxShadow: `0 0 24px ${tokens.statusSuccess}25, inset 0 1px 0 ${tokens.statusSuccess}30`,
          }}
        >
          {/* Round label */}
          <span
            className="text-[10px] font-semibold uppercase tracking-wider mb-1"
            style={{ color: tokens.statusSuccess }}
          >
            {/* Show icon if available */}
            {Icon && <Icon className="w-5 h-5 mb-1" />}
            {!Icon && `Round ${round}`}
          </span>

          {/* Score - large and prominent */}
          <span
            className="text-3xl font-bold"
            style={{ color: getScoreColor(score) }}
          >
            {score ?? "—"}
          </span>
        </div>

        {/* Status label */}
        <div className="flex items-center gap-1.5 mt-2">
          <CheckCircle className="w-3.5 h-3.5" style={{ color: tokens.statusSuccess }} />
          <span
            className="text-xs font-medium"
            style={{ color: tokens.statusSuccess }}
          >
            View Results
          </span>
        </div>
      </motion.div>
    );
  }

  // TODAY / ACTIVE ROUND - Pulsing animation, accent color
  if (status === "today" || status === "active") {
    const isLive = status === "active";
    const accentColor = isLive ? tokens.statusWarning : tokens.brandPrimary;

    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...springConfig, delay: round * 0.1 }}
        className="flex flex-col items-center group"
      >
        <div className="relative">
          {/* Pulsing ring animation */}
          <motion.div
            className="absolute inset-0 rounded-2xl"
            animate={{
              boxShadow: [
                `0 0 0 0px ${accentColor}40`,
                `0 0 0 8px ${accentColor}00`,
              ]
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
          />

          <div
            className="relative w-24 h-24 rounded-2xl flex flex-col items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${accentColor}20 0%, ${accentColor}10 100%)`,
              border: `2px solid ${accentColor}`,
              boxShadow: `0 0 20px ${accentColor}30`,
            }}
          >
            {/* Live indicator */}
            {isLive && (
              <div className="absolute top-2 right-2 flex items-center gap-1">
                <span className="relative flex h-2 w-2">
                  <span
                    className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                    style={{ backgroundColor: accentColor }}
                  />
                  <span
                    className="relative inline-flex rounded-full h-2 w-2"
                    style={{ backgroundColor: accentColor }}
                  />
                </span>
              </div>
            )}

            {/* Round label */}
            <span
              className="text-[10px] font-semibold uppercase tracking-wider mb-1"
              style={{ color: accentColor }}
            >
              Round {round}
            </span>

            {/* Play icon or Custom Icon */}
            {Icon ? (
              <Icon className="w-7 h-7" style={{ color: accentColor }} />
            ) : (
              <Play className="w-7 h-7" style={{ color: accentColor }} />
            )}

            {/* Time display */}
            {!isLive && interview?.scheduled_at && (
              <span
                className="text-xs font-medium mt-1"
                style={{ color: accentColor }}
              >
                {getScheduledDateDisplay()}
              </span>
            )}
          </div>

          {/* Action buttons */}
          {(canStart || canCancel) && (
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {canStart && onStart && (
                <button
                  onClick={(e) => { e.stopPropagation(); onStart(); }}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{
                    backgroundColor: `${accentColor}30`,
                    border: `1px solid ${accentColor}50`,
                  }}
                >
                  <Video className="w-3.5 h-3.5" style={{ color: accentColor }} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Status label */}
        <div className="flex items-center gap-1.5 mt-2">
          {isLive ? (
            <Zap className="w-3.5 h-3.5" style={{ color: accentColor }} />
          ) : (
            <Play className="w-3.5 h-3.5" style={{ color: accentColor }} />
          )}
          <span
            className="text-xs font-medium"
            style={{ color: accentColor }}
          >
            {isLive ? "Live Now" : "Today"}
          </span>
        </div>
      </motion.div>
    );
  }

  // SCHEDULED ROUND - Shows date/time, now clickable to START
  if (status === "scheduled") {
    // Check if we can start (usually true if onStart is provided)
    const canStart = !!onStart;

    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...springConfig, delay: round * 0.1 }}
        className={`relative flex flex-col items-center group ${canStart ? "cursor-pointer" : ""}`}
        onClick={(e) => {
          if (canStart && onStart) {
            e.stopPropagation();
            onStart();
          }
        }}
      >
        <div
          className="w-24 h-24 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 group-hover:shadow-lg group-hover:shadow-indigo-500/20"
          style={{
            background: `linear-gradient(135deg, ${tokens.brandSecondary}15 0%, ${tokens.brandSecondary}08 100%)`,
            border: `2px solid ${tokens.brandSecondary}50`,
          }}
        >
          {/* Default Content (Hidden on Hover if actionable) */}
          <div className={`flex flex-col items-center transition-opacity duration-200 ${canStart ? "group-hover:opacity-0" : ""}`}>
            {/* Round label */}
            <span
              className="text-[10px] font-semibold uppercase tracking-wider mb-1"
              style={{ color: tokens.brandSecondary }}
            >
              Round {round}
            </span>

            {/* Custom Icon or Clock */}
            {Icon ? (
              <Icon className="w-6 h-6 mb-1" style={{ color: tokens.brandSecondary }} />
            ) : (
              <Clock className="w-6 h-6 mb-1" style={{ color: tokens.brandSecondary }} />
            )}

            {/* Scheduled date */}
            <span
              className="text-xs font-medium"
              style={{ color: tokens.brandSecondary }}
            >
              {getScheduledDateDisplay()}
            </span>
          </div>

          {/* Hover Action (Start Interview) */}
          {canStart && (
            <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-indigo-500/10 backdrop-blur-sm">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center mb-1 shadow-lg transform group-hover:scale-110 transition-transform"
                style={{ backgroundColor: tokens.brandPrimary }}
              >
                <Video className="w-5 h-5 text-white ml-0.5" />
              </div>
              <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wide">
                Start
              </span>
            </div>
          )}
        </div>

        {/* Status label */}
        <div className="flex items-center gap-1.5 mt-2">
          <Calendar className="w-3.5 h-3.5" style={{ color: tokens.brandSecondary }} />
          <span
            className="text-xs font-medium"
            style={{ color: tokens.brandSecondary }}
          >
            Scheduled
          </span>
        </div>
      </motion.div>
    );
  }

  // CANCELLED ROUND
  if (status === "cancelled") {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...springConfig, delay: round * 0.1 }}
        className="flex flex-col items-center"
      >
        <div
          className="w-24 h-24 rounded-2xl flex flex-col items-center justify-center"
          style={{
            background: `${tokens.statusDanger}08`,
            border: `2px dashed ${tokens.statusDanger}40`,
          }}
        >
          {/* Round label */}
          <span
            className="text-[10px] font-semibold uppercase tracking-wider mb-1"
            style={{ color: tokens.statusDanger }}
          >
            Round {round}
          </span>

          {/* X icon */}
          <XCircle className="w-6 h-6" style={{ color: `${tokens.statusDanger}80` }} />
        </div>

        {/* Status label */}
        <div className="flex items-center gap-1.5 mt-2">
          <XCircle className="w-3.5 h-3.5" style={{ color: tokens.statusDanger }} />
          <span
            className="text-xs font-medium"
            style={{ color: tokens.statusDanger }}
          >
            Cancelled
          </span>
        </div>
      </motion.div>
    );
  }

  // PENDING ROUND - Dashed border, muted styling, now clickable for scheduling
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={onStart ? { scale: 1.05 } : undefined}
      whileTap={onStart ? { scale: 0.95 } : undefined}
      transition={{ ...springConfig, delay: round * 0.1 }}
      onClick={(e) => {
        if (onStart) {
          e.stopPropagation();
          onStart();
        }
      }}
      className={`flex flex-col items-center group ${onStart ? "cursor-pointer" : ""}`}
    >
      <div
        className={`w-24 h-24 rounded-2xl flex flex-col items-center justify-center transition-colors ${onStart ? "group-hover:border-indigo-500/50 group-hover:bg-indigo-500/5" : ""}`}
        style={{
          background: tokens.bgSurface,
          border: `2px dashed ${tokens.borderSubtle}`,
        }}
      >
        {/* Round label */}
        <span
          className={`text-[10px] font-semibold uppercase tracking-wider mb-2 transition-colors ${onStart ? "group-hover:text-indigo-400" : ""}`}
          style={{ color: tokens.textMuted }}
        >
          {Icon ? <div className="mb-1"><Icon className="w-4 h-4" /></div> : `Round ${round}`}
        </span>

        {/* Placeholder dash or Plus icon */}
        {onStart ? (
          <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <Calendar className="w-4 h-4 text-indigo-400" />
          </div>
        ) : (
          <div
            className="w-8 h-0.5 rounded-full mb-2"
            style={{ backgroundColor: tokens.borderSubtle }}
          />
        )}

        {/* Not scheduled text */}
        <span
          className={`text-[10px] font-medium transition-colors ${onStart ? "group-hover:text-indigo-400" : ""}`}
          style={{ color: tokens.textMuted }}
        >
          {onStart ? "Schedule Now" : "Not Scheduled"}
        </span>
      </div>

      {/* Status label */}
      <div className="flex items-center gap-1.5 mt-2">
        <Clock className="w-3.5 h-3.5" style={{ color: tokens.textMuted }} />
        <span
          className="text-xs font-medium"
          style={{ color: tokens.textMuted }}
        >
          Pending
        </span>
      </div>
    </motion.div>
  );
}

// =============================================================================
// PROGRESS ARROW COMPONENT
// =============================================================================

interface ProgressArrowProps {
  fromInterview: Interview | null;
  toInterview: Interview | null;
}

function ProgressArrow({ fromInterview, toInterview }: ProgressArrowProps) {
  // Determine arrow state based on interview progression
  const getArrowState = (): "passed" | "failed" | "pending" => {
    // If previous round was cancelled, show red (failed to progress)
    if (fromInterview?.status === "cancelled") {
      return "failed";
    }

    // If previous round is completed and next round exists (scheduled, in_progress, or completed)
    // This means the candidate passed and moved to the next round
    if (fromInterview?.status === "completed" && toInterview) {
      return "passed";
    }

    // If previous round is completed but next round doesn't exist yet
    // Could be awaiting decision or pending scheduling
    if (fromInterview?.status === "completed" && !toInterview) {
      return "pending";
    }

    // Default: pending/grey
    return "pending";
  };

  const state = getArrowState();

  const arrowColors = {
    passed: tokens.statusSuccess,
    failed: tokens.statusDanger,
    pending: tokens.borderSubtle,
  };

  const color = arrowColors[state];

  return (
    <div className="flex items-center h-24 flex-1 px-1">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...springConfig, delay: 0.2 }}
        className="flex items-center w-full"
      >
        {/* Arrow line - now flexible width */}
        <div
          className="flex-1 h-[3px] rounded-full min-w-[60px]"
          style={{ backgroundColor: color }}
        />
        {/* Arrow head - larger */}
        <div
          className="w-0 h-0 -ml-[1px]"
          style={{
            borderTop: "7px solid transparent",
            borderBottom: "7px solid transparent",
            borderLeft: `12px solid ${color}`,
          }}
        />
      </motion.div>
    </div>
  );
}

// =============================================================================
// CANDIDATE INTERVIEW CARD COMPONENT (Grouped View)
// =============================================================================

interface CandidateInterviewCardProps {
  group: GroupedCandidate;
  onViewProfile: () => void;
  onStartInterview: (interview: Interview) => void;
  onCancelInterview: (interviewId: string) => void;
  onScheduleInterview: (candidateId: string, candidateName: string, jobId: string, jobTitle: string, stage: string) => void;
  index: number;
}

function CandidateInterviewCard({
  group,
  onViewProfile,
  onStartInterview,
  onCancelInterview,
  onScheduleInterview,
  index,
}: CandidateInterviewCardProps) {
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const { data: jobs } = useJobs();

  // Find the job to get custom icons
  const job = jobs?.find(j => j.id === group.job_id || j.title === group.job_title);
  const stageIcons = job?.interview_stage_icons || [];

  const overallStatusStyles: Record<string, { bg: string; text: string; label: string }> = {
    not_started: {
      bg: tokens.bgSurface,
      text: tokens.textMuted,
      label: "Not Started",
    },
    in_progress: {
      bg: `${tokens.brandPrimary}15`,
      text: tokens.brandPrimary,
      label: "In Progress",
    },
    completed: {
      bg: `${tokens.statusSuccess}15`,
      text: tokens.statusSuccess,
      label: "Completed",
    },
    cancelled: {
      bg: `${tokens.statusDanger}10`,
      text: tokens.statusDanger,
      label: "Cancelled",
    },
  };

  const statusStyle = overallStatusStyles[group.overallStatus];

  // Helper to get icon for a round
  const getRoundIcon = (roundNumber: number) => {
    // Default fallback logic trying to map round number to icon index
    if (stageIcons.length > roundNumber) {
      // Simple heuristic: if first icon is 'bot', offset by 1
      const hasScreening = stageIcons.length > 0 && stageIcons[0] === 'bot';
      const iconIndex = hasScreening ? roundNumber : roundNumber - 1;

      if (iconIndex >= 0 && iconIndex < stageIcons.length) {
        return getStageIcon(stageIcons[iconIndex]);
      }
    }

    // Defaults if no icons configured
    if (roundNumber === 1) return Video;
    if (roundNumber === 2) return Video;
    return Building2;
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springConfig, delay: index * 0.05 }}
        onClick={onViewProfile}
        className="group relative rounded-2xl border cursor-pointer transition-all duration-300 hover:border-white/20"
        style={{
          backgroundColor: tokens.bgCard,
          borderColor: tokens.borderSubtle,
        }}
      >
        {/* Hover glow */}
        <div
          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), ${tokens.brandPrimary}08, transparent 40%)`,
          }}
        />

        <div className="relative p-6">
          {/* Header: Candidate Info + Overall Status + Average Score */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex-1 min-w-0">
              {/* Candidate Name */}
              <h3 className="text-xl font-medium text-white mb-1 group-hover:text-indigo-300 transition-colors flex items-center gap-2">
                <User className="w-5 h-5" style={{ color: tokens.textMuted }} />
                {group.candidate_name}
              </h3>

              {/* Job Title */}
              <div className="flex items-center gap-3 text-sm" style={{ color: tokens.textMuted }}>
                <span className="flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5" />
                  {group.job_title || "No job assigned"}
                </span>

                {/* Overall Status Badge */}
                <span
                  className="px-2.5 py-1 rounded-lg text-xs font-medium"
                  style={{
                    backgroundColor: statusStyle.bg,
                    color: statusStyle.text,
                  }}
                >
                  {statusStyle.label}
                </span>
              </div>

              {/* Next Interview Info */}
              {group.nextInterview && (
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    <Clock className="w-3 h-3" />
                    Next: {formatDateTime(group.nextInterview.scheduled_at!, group.nextInterview.timezone)}
                  </span>
                </div>
              )}
            </div>

            {/* Average Score */}
            {group.scores.average !== null && (
              <div className="flex flex-col items-end">
                <div className="text-3xl font-bold" style={{ color: getScoreColor(group.scores.average) }}>
                  {group.scores.average}
                </div>
                <div className="text-xs font-medium uppercase tracking-wider" style={{ color: tokens.textMuted }}>
                  Avg Score
                </div>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="relative">
            {/* Connecting Line - Background */}
            <div
              className="absolute top-12 left-12 right-12 h-[2px] -z-10"
              style={{ backgroundColor: tokens.borderSubtle }}
            />

            <div className="flex items-start justify-between relative z-0">
              {/* Round 1 */}
              <div className="flex items-center flex-1">
                <RoundBadge
                  round={1}
                  interview={group.rounds.round_1}
                  score={group.rounds.round_1?.scores?.cumulative ?? null}
                  icon={getRoundIcon(1)}
                  onStart={
                    group.rounds.round_1?.status === "scheduled"
                      ? () => onStartInterview(group.rounds.round_1!)
                      : !group.rounds.round_1
                        ? () => onScheduleInterview(group.candidate_id, group.candidate_name, group.job_id!, group.job_title, "round_1")
                        : undefined
                  }
                  onCancel={
                    group.rounds.round_1?.status === "scheduled"
                      ? () => onCancelInterview(group.rounds.round_1!.id)
                      : undefined
                  }
                  onClick={
                    group.rounds.round_1?.status === "completed"
                      ? () => setSelectedInterview(group.rounds.round_1!)
                      : undefined
                  }
                />

                {/* Arrow 1→2: Green if R1 completed and R2 exists, Red if R1 cancelled, Grey if pending */}
                <ProgressArrow
                  fromInterview={group.rounds.round_1}
                  toInterview={group.rounds.round_2}
                />

                <RoundBadge
                  round={2}
                  interview={group.rounds.round_2}
                  score={group.scores.round_2}
                  onStart={group.rounds.round_2 ? () => onStartInterview(group.rounds.round_2!) : () => onScheduleInterview(group.candidate_id, group.candidate_name, group.job_id || "", group.job_title || "", "round_2")}
                  onCancel={group.rounds.round_2 ? () => onCancelInterview(group.rounds.round_2!.id) : undefined}
                  onClick={
                    group.rounds.round_2?.status === "completed"
                      ? () => setSelectedInterview(group.rounds.round_2!)
                      : undefined
                  }
                />

                {/* Arrow 2→3: Green if R2 completed and R3 exists, Red if R2 cancelled, Grey if pending */}
                <ProgressArrow
                  fromInterview={group.rounds.round_2}
                  toInterview={group.rounds.round_3}
                />

                <RoundBadge
                  round={3}
                  interview={group.rounds.round_3}
                  score={group.scores.round_3}
                  onStart={group.rounds.round_3 ? () => onStartInterview(group.rounds.round_3!) : () => onScheduleInterview(group.candidate_id, group.candidate_name, group.job_id || "", group.job_title || "", "round_3")}
                  onCancel={group.rounds.round_3 ? () => onCancelInterview(group.rounds.round_3!.id) : undefined}
                  onClick={
                    group.rounds.round_3?.status === "completed"
                      ? () => setSelectedInterview(group.rounds.round_3!)
                      : undefined
                  }
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t" style={{ borderColor: tokens.borderSubtle }}>
              <div className="flex items-center gap-2 text-sm" style={{ color: tokens.textMuted }}>
                <span>{group.interviews.length} interview{group.interviews.length !== 1 ? "s" : ""} total</span>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onViewProfile();
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-colors"
                style={{
                  backgroundColor: tokens.bgSurface,
                  border: `1px solid ${tokens.borderSubtle}`,
                  color: tokens.textSecondary,
                }}
              >
                <Eye className="w-4 h-4" />
                View Profile
                <ChevronRight className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {selectedInterview && (
          <AnalyticsModal
            interview={selectedInterview}
            onClose={() => setSelectedInterview(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// =============================================================================
// FILTER PANEL COMPONENT
// =============================================================================

interface FilterPanelProps {
  isOpen: boolean;
  selectedInterviewer: string;
  setSelectedInterviewer: (value: string) => void;
  selectedJob: string;
  setSelectedJob: (value: string) => void;
  dateFrom: string;
  setDateFrom: (value: string) => void;
  dateTo: string;
  setDateTo: (value: string) => void;
  interviewers: Interviewer[];
  jobs: Job[];
  onClear: () => void;
  activeFilterCount: number;
}

function FilterPanel({
  isOpen,
  selectedInterviewer,
  setSelectedInterviewer,
  selectedJob,
  setSelectedJob,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  interviewers,
  jobs,
  onClear,
  activeFilterCount,
}: FilterPanelProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={springConfig}
          className="overflow-hidden"
        >
          <div
            className="rounded-2xl border p-6 mt-4"
            style={{
              backgroundColor: tokens.bgCard,
              borderColor: tokens.borderSubtle,
            }}
          >
            {/* Active Filters */}
            {activeFilterCount > 0 && (
              <div className="flex items-center gap-2 flex-wrap mb-4 pb-4 border-b" style={{ borderColor: tokens.borderSubtle }}>
                <span className="text-sm" style={{ color: tokens.textMuted }}>
                  Active filters:
                </span>
                {selectedInterviewer && (
                  <button
                    onClick={() => setSelectedInterviewer("")}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                    style={{
                      backgroundColor: `${tokens.brandSecondary}15`,
                      border: `1px solid ${tokens.brandSecondary}30`,
                      color: tokens.brandSecondary,
                    }}
                  >
                    <UserCheck className="w-3 h-3" />
                    {interviewers.find((i) => i.id === selectedInterviewer)?.name || "Interviewer"}
                    <X className="w-3 h-3" />
                  </button>
                )}
                {selectedJob && (
                  <button
                    onClick={() => setSelectedJob("")}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                    style={{
                      backgroundColor: `${tokens.statusWarning}15`,
                      border: `1px solid ${tokens.statusWarning}30`,
                      color: tokens.statusWarning,
                    }}
                  >
                    <Briefcase className="w-3 h-3" />
                    {jobs.find((j) => j.id === selectedJob)?.title || "Job"}
                    <X className="w-3 h-3" />
                  </button>
                )}
                {dateFrom && (
                  <button
                    onClick={() => setDateFrom("")}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                    style={{
                      backgroundColor: `${tokens.statusSuccess}15`,
                      border: `1px solid ${tokens.statusSuccess}30`,
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
                      backgroundColor: `${tokens.statusSuccess}15`,
                      border: `1px solid ${tokens.statusSuccess}30`,
                      color: tokens.statusSuccess,
                    }}
                  >
                    <Calendar className="w-3 h-3" />
                    To: {dateTo}
                    <X className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={onClear}
                  className="text-xs underline ml-2"
                  style={{ color: tokens.textMuted }}
                >
                  Clear all
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Interviewer Filter */}
              <div>
                <label className="text-sm mb-2 block" style={{ color: tokens.textSecondary }}>
                  Interviewer
                </label>
                <select
                  value={selectedInterviewer}
                  onChange={(e) => setSelectedInterviewer(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  style={{
                    backgroundColor: tokens.bgSurface,
                    border: `1px solid ${tokens.borderSubtle}`,
                    color: tokens.textPrimary,
                  }}
                >
                  <option value="">All Interviewers</option>
                  {interviewers.map((interviewer) => (
                    <option key={interviewer.id} value={interviewer.id}>
                      {interviewer.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Job Filter */}
              <div>
                <label className="text-sm mb-2 block" style={{ color: tokens.textSecondary }}>
                  Job Position
                </label>
                <select
                  value={selectedJob}
                  onChange={(e) => setSelectedJob(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  style={{
                    backgroundColor: tokens.bgSurface,
                    border: `1px solid ${tokens.borderSubtle}`,
                    color: tokens.textPrimary,
                  }}
                >
                  <option value="">All Jobs</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date From */}
              <div>
                <label className="text-sm mb-2 block" style={{ color: tokens.textSecondary }}>
                  From Date
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  style={{
                    backgroundColor: tokens.bgSurface,
                    border: `1px solid ${tokens.borderSubtle}`,
                    color: tokens.textPrimary,
                  }}
                />
              </div>

              {/* Date To */}
              <div>
                <label className="text-sm mb-2 block" style={{ color: tokens.textSecondary }}>
                  To Date
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  style={{
                    backgroundColor: tokens.bgSurface,
                    border: `1px solid ${tokens.borderSubtle}`,
                    color: tokens.textPrimary,
                  }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// =============================================================================
// EMPTY STATE COMPONENT
// =============================================================================

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={springConfig}
      className="rounded-3xl border p-12 text-center"
      style={{
        backgroundColor: tokens.bgCard,
        borderColor: tokens.borderSubtle,
      }}
    >
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
        style={{ backgroundColor: tokens.bgSurface }}
      >
        <Calendar className="w-10 h-10" style={{ color: tokens.textMuted }} />
      </div>
      <h3 className="text-xl font-light text-white mb-2">No interviews found</h3>
      <p className="text-sm max-w-sm mx-auto" style={{ color: tokens.textMuted }}>
        {hasFilters
          ? "Try adjusting your filters to see more results"
          : "Schedule interviews with candidates to see them here"}
      </p>
    </motion.div>
  );
}

// =============================================================================
// LOADING STATE COMPONENT
// =============================================================================

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      >
        <Loader2 className="w-8 h-8" style={{ color: tokens.brandPrimary }} />
      </motion.div>
      <p className="mt-4 text-sm" style={{ color: tokens.textMuted }}>
        Loading interviews...
      </p>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function InterviewsPage() {
  const router = useRouter();
  const { recruiter } = useAuth();

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
  const [showStartModal, setShowStartModal] = useState(false);
  const [stagedInterview, setStagedInterview] = useState<Interview | null>(null);

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

  // Calculate stats
  const stats = useMemo(() => {
    const today = new Date();
    const todayInterviews = (interviews as Interview[]).filter(
      (i) => i.scheduled_at && isToday(new Date(i.scheduled_at)) && i.status === "scheduled"
    );
    const thisWeekInterviews = (interviews as Interview[]).filter(
      (i) => i.scheduled_at && isThisWeek(new Date(i.scheduled_at)) && i.status === "scheduled"
    );
    const completedInterviews = (interviews as Interview[]).filter(
      (i) => i.status === "completed"
    );
    const cancelledInterviews = (interviews as Interview[]).filter(
      (i) => i.status === "cancelled"
    );

    return {
      today: todayInterviews.length,
      thisWeek: thisWeekInterviews.length,
      completed: completedInterviews.length,
      cancelled: cancelledInterviews.length,
    };
  }, [interviews]);

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
    selectedInterviewer || selectedJob || dateFrom || dateTo;

  const activeFilterCount =
    (selectedInterviewer ? 1 : 0) +
    (selectedJob ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  const [scheduleData, setScheduleData] = useState<{
    candidateId: string;
    candidateName: string;
    jobId: string;
    jobTitle: string;
    stage: string;
  } | null>(null);

  // ... (keep existing effects)

  const handleScheduleInterview = (candidateId: string, candidateName: string, jobId: string, jobTitle: string, stage: string) => {
    setScheduleData({ candidateId, candidateName, jobId, jobTitle, stage });
  };

  // Filter interviews by search query (client-side)
  const filteredInterviews = useMemo(() => {
    return (interviews as Interview[]).filter((interview) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        interview.candidate_name?.toLowerCase().includes(query) ||
        interview.interviewer_name?.toLowerCase().includes(query) ||
        interview.job_title?.toLowerCase().includes(query) ||
        interview.stage?.toLowerCase().includes(query)
      );
    });
  }, [interviews, searchQuery]);

  // Count by status for tabs
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { "": filteredInterviews.length };
    filteredInterviews.forEach((i) => {
      counts[i.status] = (counts[i.status] || 0) + 1;
    });
    return counts;
  }, [filteredInterviews]);

  // Filter by status tab
  const displayedInterviews = useMemo(() => {
    if (!selectedStatus) return filteredInterviews;
    return filteredInterviews.filter((i) => i.status === selectedStatus);
  }, [filteredInterviews, selectedStatus]);

  // Group interviews by candidate for the new grouped view
  const groupedCandidates = useMemo(() => {
    return groupInterviewsByCandidate(displayedInterviews);
  }, [displayedInterviews]);

  // Calculate unique candidate count for header
  const uniqueCandidateCount = groupedCandidates.length;

  return (
    <AppLayout>
      {/* Ambient Background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -20%, ${tokens.brandPrimary}15, transparent),
            radial-gradient(ellipse 60% 40% at 100% 0%, ${tokens.brandSecondary}10, transparent),
            ${tokens.bgApp}
          `,
        }}
      />

      {/* Grain Texture */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative px-6 py-8 max-w-7xl mx-auto">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springConfig}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-3xl font-light tracking-tight text-white mb-1">
              Interviews
            </h1>
            <p style={{ color: tokens.textMuted }}>
              {uniqueCandidateCount} candidate{uniqueCandidateCount !== 1 ? "s" : ""} • {filteredInterviews.length} interview{filteredInterviews.length !== 1 ? "s" : ""}
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-colors"
            style={{
              backgroundColor: tokens.bgCard,
              border: `1px solid ${tokens.borderSubtle}`,
              color: tokens.textSecondary,
            }}
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </motion.button>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Scheduled Today"
            value={stats.today}
            icon={<Zap className="w-5 h-5" />}
            color={tokens.brandPrimary}
            delay={0}
          />
          <StatCard
            label="This Week"
            value={stats.thisWeek}
            icon={<CalendarCheck className="w-5 h-5" />}
            color={tokens.brandSecondary}
            delay={0.05}
          />
          <StatCard
            label="Completed"
            value={stats.completed}
            icon={<CheckCircle className="w-5 h-5" />}
            color={tokens.statusSuccess}
            delay={0.1}
          />
          <StatCard
            label="Cancelled"
            value={stats.cancelled}
            icon={<CalendarX className="w-5 h-5" />}
            color={tokens.statusDanger}
            delay={0.15}
          />
        </div>

        {/* Search and Filters */}
        <div className="mb-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <CommandBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search by candidate, interviewer, or job..."
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all ${showFilters || hasActiveFilters
                ? "ring-2 ring-indigo-500/20"
                : ""
                }`}
              style={{
                backgroundColor: showFilters || hasActiveFilters ? tokens.bgCard : tokens.bgSurface,
                borderColor: showFilters || hasActiveFilters ? tokens.brandPrimary + "40" : tokens.borderSubtle,
                color: showFilters || hasActiveFilters ? tokens.textPrimary : tokens.textSecondary,
              }}
            >
              <Filter className="w-4 h-4" />
              Filters
              {hasActiveFilters && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs"
                  style={{
                    backgroundColor: tokens.brandPrimary + "20",
                    color: tokens.brandPrimary,
                  }}
                >
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown
                className={`w-4 h-4 transition-transform ${showFilters ? "rotate-180" : ""}`}
              />
            </motion.button>
          </div>

          <FilterPanel
            isOpen={showFilters}
            selectedInterviewer={selectedInterviewer}
            setSelectedInterviewer={setSelectedInterviewer}
            selectedJob={selectedJob}
            setSelectedJob={setSelectedJob}
            dateFrom={dateFrom}
            setDateFrom={setDateFrom}
            dateTo={dateTo}
            setDateTo={setDateTo}
            interviewers={interviewers as Interviewer[]}
            jobs={jobs as Job[]}
            onClear={clearFilters}
            activeFilterCount={activeFilterCount}
          />
        </div>

        {/* Status Tabs */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ ...springConfig, delay: 0.1 }}
          className="flex items-center gap-2 mb-6 overflow-x-auto pb-2"
        >
          {STATUS_TABS.map((tab) => {
            const Icon = tab.icon;
            const count = statusCounts[tab.value] || 0;
            const isActive = selectedStatus === tab.value;

            return (
              <button
                key={tab.value}
                onClick={() => setSelectedStatus(tab.value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${isActive ? "ring-2 ring-indigo-500/20" : ""
                  }`}
                style={{
                  backgroundColor: isActive ? tokens.bgCard : "transparent",
                  border: `1px solid ${isActive ? tokens.brandPrimary + "40" : tokens.borderSubtle}`,
                  color: isActive ? tokens.textPrimary : tokens.textMuted,
                }}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                <span
                  className="px-1.5 py-0.5 rounded text-xs"
                  style={{
                    backgroundColor: isActive ? tokens.brandPrimary + "20" : tokens.bgSurface,
                    color: isActive ? tokens.brandPrimary : tokens.textMuted,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </motion.div>

        {/* Results - Candidate-Centric Grouped View */}
        {isLoading ? (
          <LoadingState />
        ) : groupedCandidates.length === 0 ? (
          <EmptyState hasFilters={!!hasActiveFilters || !!selectedStatus} />
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {groupedCandidates.map((group, index) => (
                <CandidateInterviewCard
                  key={group.candidate_id}
                  group={group}
                  index={index}
                  onViewProfile={() => {
                    if (group.job_id) {
                      router.push(`/jobs/${group.job_id}/candidates/${group.candidate_id}`);
                    } else {
                      router.push(`/talent-pool/${group.candidate_id}`);
                    }
                  }}
                  onScheduleInterview={handleScheduleInterview}
                  onStartInterview={(interview) => {
                    setStagedInterview(interview);
                    setShowStartModal(true);
                  }}
                  onCancelInterview={(interviewId) => {
                    setCancellingId(interviewId);
                    setCancelModalOpen(true);
                  }}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
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
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={springConfig}
              className="rounded-2xl border p-6 max-w-md w-full mx-4"
              style={{
                backgroundColor: tokens.bgCard,
                borderColor: tokens.borderSubtle,
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${tokens.statusDanger}15` }}
                >
                  <AlertCircle className="w-5 h-5" style={{ color: tokens.statusDanger }} />
                </div>
                <h3 className="text-lg font-medium text-white">Cancel Interview</h3>
              </div>
              <p className="text-sm mb-4" style={{ color: tokens.textMuted }}>
                Are you sure you want to cancel this interview? This action cannot be undone.
              </p>
              <div className="mb-4">
                <label className="text-sm mb-2 block" style={{ color: tokens.textSecondary }}>
                  Reason (optional)
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Enter cancellation reason..."
                  className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 placeholder:text-white/30 resize-none"
                  style={{
                    backgroundColor: tokens.bgSurface,
                    border: `1px solid ${tokens.borderSubtle}`,
                    color: tokens.textPrimary,
                  }}
                  rows={3}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setCancelModalOpen(false);
                    setCancellingId(null);
                    setCancelReason("");
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm transition-colors"
                  style={{
                    backgroundColor: tokens.bgSurface,
                    border: `1px solid ${tokens.borderSubtle}`,
                    color: tokens.textSecondary,
                  }}
                >
                  Keep Interview
                </button>
                <button
                  onClick={handleCancelInterview}
                  disabled={cancelInterviewMutation.isPending}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: `${tokens.statusDanger}20`,
                    border: `1px solid ${tokens.statusDanger}30`,
                    color: tokens.statusDanger,
                  }}
                >
                  {cancelInterviewMutation.isPending ? "Cancelling..." : "Cancel Interview"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Start Interview Modal */}
      {/* Start Interview Modal (now with "Manage Interview" flow) */}
      <StartInterviewModal
        isOpen={showStartModal}
        onClose={() => {
          setShowStartModal(false);
          setStagedInterview(null);
        }}
        candidateId={stagedInterview?.candidate_id || ""}
        candidateName={stagedInterview?.candidate_name || ""}
        jobTitle={stagedInterview?.job_title || ""}
        onReschedule={() => {
          // Transition from Start Modal -> Schedule Modal (Edit Mode)
          if (stagedInterview) {
            // Cast to any to access potentially deeper properties or avoid strict type checks for now
            const interview = stagedInterview as any;

            setScheduleData({
              candidateId: interview.candidate_id,
              candidateName: interview.candidate_name,
              jobId: interview.job_id,
              jobTitle: interview.job_title,
              stage: interview.round_key || "round_1",
            });
            setShowStartModal(false);
            // setScheduleData being non-null triggers the modal to open
          }
        }}
      />

      {scheduleData && (
        <ScheduleInterviewModal
          isOpen={true}
          onClose={() => setScheduleData(null)}
          onScheduled={() => {
            refetch();
            setScheduleData(null);
          }}
          candidateId={scheduleData.candidateId}
          candidateName={scheduleData.candidateName}
          jobId={scheduleData.jobId}
          jobTitle={scheduleData.jobTitle}
          stage={scheduleData.stage}
          allowStageSelection={false}
        />
      )}
    </AppLayout>
  );
}
