"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRecruiter } from "@/contexts/RecruiterContext";
import { useAuth } from "@/contexts/AuthContext";
import RecruiterSelector from "@/components/RecruiterSelector";
import AppLayout from "@/components/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  Users,
  CheckCircle,
  TrendingUp,
  Plus,
  ChevronRight,
  Clock,
  Star,
  Target,
  Search,
  Command,
  Sparkles,
  ArrowUpRight,
  Zap,
  Calendar,
  Loader2,
  Settings,
  Activity,
  Award,
  BarChart3,
} from "lucide-react";
import UpcomingInterviews from "@/components/UpcomingInterviews";
import { tokens, springConfig } from "@/lib/design-tokens";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

interface RecruiterStats {
  recruiter_id: string;
  recruiter_name: string;
  total_jobs: number;
  active_jobs: number;
  closed_jobs: number;
  total_candidates: number;
  interviewed_candidates: number;
  pending_candidates: number;
  strong_hires: number;
  hires: number;
  maybes: number;
  no_hires: number;
  avg_candidate_score: number;
  hire_rate: number;
}

interface RecentActivity {
  type: string;
  candidate_name?: string;
  job_title?: string;
  job_id?: string;
  score?: number;
  recommendation?: string;
  timestamp: string;
  interview_id?: string;
}

interface TopCandidate {
  candidate_id: string;
  candidate_name?: string;
  job_id: string;
  job_title?: string;
  score: number;
  recommendation: string;
}

interface Job {
  id: string;
  title: string;
  status: string;
  candidate_count: number;
  interviewed_count: number;
}

// =============================================================================
// ANIMATED NUMBER COMPONENT
// =============================================================================

function AnimatedNumber({ value, suffix = "" }: { value: number | string; suffix?: string }) {
  const numericValue = typeof value === "string" ? parseFloat(value) : value;
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 1000;
    const steps = 30;
    const increment = numericValue / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= numericValue) {
        setDisplayValue(numericValue);
        clearInterval(timer);
      } else {
        setDisplayValue(current);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [numericValue]);

  return (
    <span>
      {typeof value === "string" && value.includes("%")
        ? `${displayValue.toFixed(0)}%`
        : displayValue.toFixed(0)}
      {suffix}
    </span>
  );
}

// =============================================================================
// STAT CARD COMPONENT
// =============================================================================

interface StatCardProps {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  color: string;
  delay?: number;
  trend?: { value: number; positive: boolean };
}

function StatCard({ icon, value, label, color, delay = 0, trend }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springConfig, delay }}
      className="relative overflow-hidden rounded-2xl border group"
      style={{
        backgroundColor: tokens.bgCard,
        borderColor: tokens.borderSubtle,
      }}
    >
      {/* Subtle glow effect */}
      <div
        className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-20 blur-3xl transition-opacity group-hover:opacity-30"
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
          {trend && (
            <div
              className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full"
              style={{
                backgroundColor: trend.positive ? `${tokens.statusSuccess}15` : `${tokens.statusDanger}15`,
                color: trend.positive ? tokens.statusSuccess : tokens.statusDanger,
              }}
            >
              <TrendingUp className={`w-3 h-3 ${!trend.positive ? "rotate-180" : ""}`} />
              {trend.value}%
            </div>
          )}
        </div>
        <div className="text-3xl font-light tracking-tight text-white mb-1">
          <AnimatedNumber value={value} />
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
}

function CommandBar({ value, onChange }: CommandBarProps) {
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("dashboard-search")?.focus();
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
      className={`relative rounded-2xl border transition-all duration-300 ${
        isFocused ? "ring-2 ring-indigo-500/20" : ""
      }`}
      style={{
        backgroundColor: tokens.bgSurface,
        borderColor: isFocused ? tokens.brandPrimary + "40" : tokens.borderSubtle,
      }}
    >
      <div className="flex items-center px-4 py-3">
        <Search className="w-5 h-5 mr-3" style={{ color: tokens.textMuted }} />
        <input
          id="dashboard-search"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Search jobs, candidates, or interviews..."
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
// JOB CARD COMPONENT
// =============================================================================

interface JobCardProps {
  job: Job;
  index: number;
  onClick: () => void;
}

function JobCard({ job, index, onClick }: JobCardProps) {
  const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
    active: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
    draft: { bg: "bg-slate-500/10", text: "text-slate-400", dot: "bg-slate-400" },
    paused: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
    closed: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
  };

  const status = statusColors[job.status] || statusColors.draft;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...springConfig, delay: index * 0.05 }}
      onClick={onClick}
      className="group flex items-center p-4 rounded-xl border cursor-pointer transition-all duration-300 hover:border-white/20"
      style={{
        backgroundColor: tokens.bgSurface,
        borderColor: tokens.borderSubtle,
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1.5">
          <h4 className="font-medium text-white truncate group-hover:text-indigo-300 transition-colors">
            {job.title}
          </h4>
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs ${status.bg} ${status.text}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {job.status}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm" style={{ color: tokens.textMuted }}>
          <span className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            {job.candidate_count} candidates
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" />
            {job.interviewed_count} interviewed
          </span>
        </div>
      </div>
      <ArrowUpRight
        className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: tokens.brandPrimary }}
      />
    </motion.div>
  );
}

// =============================================================================
// TOP CANDIDATE CARD COMPONENT
// =============================================================================

interface TopCandidateCardProps {
  candidate: TopCandidate;
  index: number;
  onClick: () => void;
}

function TopCandidateCard({ candidate, index, onClick }: TopCandidateCardProps) {
  const getRecommendationStyle = (rec: string) => {
    switch (rec) {
      case "strong_hire":
        return { bg: "bg-emerald-500/10", text: "text-emerald-400" };
      case "hire":
        return { bg: "bg-green-500/10", text: "text-green-400" };
      case "maybe":
        return { bg: "bg-amber-500/10", text: "text-amber-400" };
      default:
        return { bg: "bg-red-500/10", text: "text-red-400" };
    }
  };

  const style = getRecommendationStyle(candidate.recommendation);
  const initials = (candidate.candidate_name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springConfig, delay: index * 0.05 }}
      onClick={onClick}
      className="group flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-300 hover:border-white/20"
      style={{
        backgroundColor: tokens.bgSurface,
        borderColor: tokens.borderSubtle,
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-medium"
        style={{
          backgroundColor: tokens.brandPrimary + "20",
          color: tokens.brandPrimary,
        }}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-white text-sm truncate group-hover:text-indigo-300 transition-colors">
          {candidate.candidate_name || "Unknown"}
        </div>
        <div className="text-xs truncate" style={{ color: tokens.textMuted }}>
          {candidate.job_title}
        </div>
      </div>
      <div className="text-right">
        <div className="text-lg font-semibold text-white">{candidate.score.toFixed(0)}</div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
          {candidate.recommendation.replace("_", " ")}
        </span>
      </div>
    </motion.div>
  );
}

// =============================================================================
// ACTIVITY ITEM COMPONENT
// =============================================================================

interface ActivityItemProps {
  activity: RecentActivity;
  index: number;
}

function ActivityItem({ activity, index }: ActivityItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...springConfig, delay: index * 0.05 }}
      className="flex items-start gap-3 text-sm"
    >
      <div
        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
        style={{ backgroundColor: tokens.brandPrimary }}
      />
      <div className="flex-1 min-w-0">
        <p style={{ color: tokens.textSecondary }}>
          <span className="font-medium text-white">{activity.candidate_name}</span>{" "}
          interviewed for{" "}
          <span style={{ color: tokens.brandPrimary }} className="font-medium">
            {activity.job_title}
          </span>
        </p>
        <p className="text-xs mt-0.5" style={{ color: tokens.textMuted }}>
          {new Date(activity.timestamp).toLocaleDateString()}
        </p>
      </div>
      {activity.score && (
        <div className="font-semibold" style={{ color: tokens.textSecondary }}>
          {activity.score.toFixed(0)}
        </div>
      )}
    </motion.div>
  );
}

// =============================================================================
// SECTION CARD COMPONENT
// =============================================================================

interface SectionCardProps {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  delay?: number;
}

function SectionCard({ title, icon, action, children, delay = 0 }: SectionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springConfig, delay }}
      className="rounded-2xl border"
      style={{
        backgroundColor: tokens.bgCard,
        borderColor: tokens.borderSubtle,
      }}
    >
      <div
        className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: tokens.borderSubtle }}
      >
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          {icon}
          {title}
        </h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </motion.div>
  );
}

// =============================================================================
// EMPTY STATE COMPONENT
// =============================================================================

function EmptyState({ icon, message, action }: { icon: React.ReactNode; message: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-8">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
        style={{ backgroundColor: tokens.bgSurface }}
      >
        {icon}
      </div>
      <p className="text-sm mb-4" style={{ color: tokens.textMuted }}>
        {message}
      </p>
      {action}
    </div>
  );
}

// =============================================================================
// PERFORMANCE GRID COMPONENT
// =============================================================================

interface PerformanceGridProps {
  stats: RecruiterStats;
}

function PerformanceGrid({ stats }: PerformanceGridProps) {
  const items = [
    { value: stats.total_jobs, label: "Total Jobs", color: tokens.textPrimary },
    { value: stats.total_candidates, label: "Total Candidates", color: tokens.textPrimary },
    { value: stats.interviewed_candidates, label: "Interviewed", color: tokens.textPrimary },
    { value: stats.strong_hires, label: "Strong Hires", color: tokens.statusSuccess },
    { value: stats.avg_candidate_score.toFixed(0), label: "Avg Score", color: tokens.textPrimary },
    { value: `${stats.hire_rate.toFixed(0)}%`, label: "Hire Rate", color: tokens.brandPrimary },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springConfig, delay: 0.4 }}
      className="rounded-2xl border overflow-hidden"
      style={{
        backgroundColor: tokens.bgCard,
        borderColor: tokens.borderSubtle,
      }}
    >
      {/* Gradient header */}
      <div
        className="px-5 py-4 border-b"
        style={{
          borderColor: tokens.borderSubtle,
          background: `linear-gradient(135deg, ${tokens.brandPrimary}10, ${tokens.brandSecondary}10)`,
        }}
      >
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5" style={{ color: tokens.brandPrimary }} />
          Performance Summary
        </h3>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {items.map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...springConfig, delay: 0.5 + index * 0.05 }}
              className="text-center p-4 rounded-xl border"
              style={{
                backgroundColor: tokens.bgSurface,
                borderColor: tokens.borderSubtle,
              }}
            >
              <div className="text-2xl font-light tracking-tight mb-1" style={{ color: item.color }}>
                {item.value}
              </div>
              <div className="text-xs uppercase tracking-wider" style={{ color: tokens.textMuted }}>
                {item.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// LOADING STATE COMPONENT
// =============================================================================

function LoadingState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-20"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      >
        <Loader2 className="w-8 h-8" style={{ color: tokens.brandPrimary }} />
      </motion.div>
      <p className="mt-4 text-sm" style={{ color: tokens.textMuted }}>
        Loading your dashboard...
      </p>
    </motion.div>
  );
}

// =============================================================================
// WELCOME STATE COMPONENT
// =============================================================================

function WelcomeState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springConfig}
    >
      <div className="relative">
        {/* Glow effect */}
        <div
          className="absolute -inset-1 rounded-3xl blur-xl opacity-40"
          style={{
            background: `linear-gradient(135deg, ${tokens.brandPrimary}30, transparent, ${tokens.brandSecondary}30)`,
          }}
        />

        <div
          className="relative rounded-3xl border text-center py-16"
          style={{
            backgroundColor: tokens.bgCard,
            borderColor: tokens.borderSubtle,
          }}
        >
          <motion.div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{
              background: `linear-gradient(135deg, ${tokens.brandPrimary}, ${tokens.brandSecondary})`,
            }}
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles className="w-10 h-10 text-white" />
          </motion.div>
          <h3 className="text-2xl font-light text-white mb-3">Welcome to Briefing Room</h3>
          <p className="max-w-md mx-auto" style={{ color: tokens.textMuted }}>
            Select or create a recruiter to view your dashboard and start managing your hiring pipeline.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function DashboardPage() {
  const router = useRouter();
  const { currentRecruiter } = useRecruiter();
  const { isAuthenticated, isLoading: authLoading, token } = useAuth();

  const [stats, setStats] = useState<RecruiterStats | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [topCandidates, setTopCandidates] = useState<TopCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchedForRecruiterRef = useRef<string | null>(null);

  const getHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }, [token]);

  const fetchDashboardData = useCallback(
    async (recruiterId: string) => {
      if (fetchedForRecruiterRef.current === recruiterId) {
        return;
      }
      fetchedForRecruiterRef.current = recruiterId;

      try {
        setLoading(true);
        const headers = getHeaders();

        const statsResponse = await fetch(`${API_URL}/api/recruiters/${recruiterId}/stats`, { headers });
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats(statsData);
        }

        const jobsResponse = await fetch(`${API_URL}/api/jobs/?recruiter_id=${recruiterId}`, { headers });
        if (jobsResponse.ok) {
          const jobsData = await jobsResponse.json();
          const sortedJobs = jobsData.sort((a: Job, b: Job) => {
            if (a.status === "active" && b.status !== "active") return -1;
            if (a.status !== "active" && b.status === "active") return 1;
            return 0;
          });
          setJobs(sortedJobs.slice(0, 5));
        }

        const activityResponse = await fetch(`${API_URL}/api/dashboard/activity?limit=5`, { headers });
        if (activityResponse.ok) {
          const activityData = await activityResponse.json();
          setActivities(activityData.activities || []);
        }

        const topResponse = await fetch(`${API_URL}/api/dashboard/top-candidates?limit=5`, { headers });
        if (topResponse.ok) {
          const topData = await topResponse.json();
          setTopCandidates(topData.candidates || []);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        fetchedForRecruiterRef.current = null;
      } finally {
        setLoading(false);
      }
    },
    [getHeaders]
  );

  useEffect(() => {
    if (isAuthenticated && currentRecruiter?.id) {
      if (fetchedForRecruiterRef.current !== currentRecruiter.id) {
        fetchedForRecruiterRef.current = null;
      }
      fetchDashboardData(currentRecruiter.id);
    } else if (!authLoading && !currentRecruiter) {
      setLoading(false);
    }
  }, [isAuthenticated, currentRecruiter?.id, authLoading, fetchDashboardData]);

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
        {/* Recruiter Selector */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springConfig}
          className="flex items-center justify-end mb-6"
        >
          <RecruiterSelector />
        </motion.div>

        <AnimatePresence mode="wait">
          {!currentRecruiter ? (
            <WelcomeState key="welcome" />
          ) : loading ? (
            <LoadingState key="loading" />
          ) : (
            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Welcome Header */}
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-8">
                <div>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ ...springConfig, delay: 0.1 }}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mb-3"
                    style={{
                      backgroundColor: `${tokens.brandPrimary}15`,
                      border: `1px solid ${tokens.brandPrimary}30`,
                      color: tokens.brandPrimary,
                    }}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    AI-Powered Insights
                  </motion.div>
                  <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springConfig, delay: 0.15 }}
                    className="text-3xl font-light tracking-tight text-white mb-2"
                  >
                    Welcome back, {currentRecruiter.name.split(" ")[0]}
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springConfig, delay: 0.2 }}
                    style={{ color: tokens.textMuted }}
                  >
                    Here's an overview of your hiring pipeline
                  </motion.p>
                </div>

                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...springConfig, delay: 0.25 }}
                  className="flex items-center gap-3"
                >
                  <div className="flex-1 lg:w-80">
                    <CommandBar value={searchQuery} onChange={setSearchQuery} />
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => router.push("/jobs/new")}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium transition-all"
                    style={{
                      background: `linear-gradient(135deg, ${tokens.brandPrimary}, ${tokens.brandSecondary})`,
                      color: "white",
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    Create Job
                  </motion.button>
                </motion.div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <StatCard
                  icon={<Briefcase className="w-5 h-5" />}
                  value={stats?.active_jobs || 0}
                  label="Active Jobs"
                  color={tokens.brandPrimary}
                  delay={0.1}
                />
                <StatCard
                  icon={<Users className="w-5 h-5" />}
                  value={stats?.total_candidates || 0}
                  label="Candidates"
                  color={tokens.brandSecondary}
                  delay={0.15}
                />
                <StatCard
                  icon={<Award className="w-5 h-5" />}
                  value={(stats?.strong_hires || 0) + (stats?.hires || 0)}
                  label="Hire Ready"
                  color={tokens.statusSuccess}
                  delay={0.2}
                />
                <StatCard
                  icon={<TrendingUp className="w-5 h-5" />}
                  value={`${stats?.hire_rate.toFixed(0) || 0}%`}
                  label="Hire Rate"
                  color={tokens.statusWarning}
                  delay={0.25}
                />
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Jobs Section */}
                <div className="lg:col-span-2">
                  <SectionCard
                    title="Jobs"
                    icon={<Briefcase className="w-5 h-5" style={{ color: tokens.textMuted }} />}
                    action={
                      <Link
                        href="/jobs"
                        className="text-sm flex items-center gap-1 transition-colors"
                        style={{ color: tokens.brandPrimary }}
                      >
                        View All
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    }
                    delay={0.15}
                  >
                    {jobs.length === 0 ? (
                      <EmptyState
                        icon={<Briefcase className="w-8 h-8" style={{ color: tokens.textMuted }} />}
                        message="No jobs yet"
                        action={
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => router.push("/jobs/new")}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium mx-auto"
                            style={{
                              backgroundColor: `${tokens.brandPrimary}20`,
                              border: `1px solid ${tokens.brandPrimary}30`,
                              color: tokens.brandPrimary,
                            }}
                          >
                            <Plus className="w-4 h-4" />
                            Create Your First Job
                          </motion.button>
                        }
                      />
                    ) : (
                      <div className="space-y-3">
                        {jobs.map((job, index) => (
                          <JobCard
                            key={job.id}
                            job={job}
                            index={index}
                            onClick={() => router.push(`/jobs/${job.id}`)}
                          />
                        ))}
                      </div>
                    )}
                  </SectionCard>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Upcoming Interviews */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springConfig, delay: 0.2 }}
                  >
                    <UpcomingInterviews limit={5} showHeader={true} />
                  </motion.div>

                  {/* Quick Actions */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springConfig, delay: 0.25 }}
                    className="rounded-2xl border p-4"
                    style={{
                      backgroundColor: tokens.bgCard,
                      borderColor: tokens.borderSubtle,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: tokens.textSecondary }}>
                        Interviewer Availability
                      </span>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => router.push("/dashboard/availability")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
                        style={{
                          backgroundColor: tokens.bgSurface,
                          color: tokens.textMuted,
                        }}
                      >
                        <Settings className="w-3.5 h-3.5" />
                        Manage
                      </motion.button>
                    </div>
                  </motion.div>

                  {/* Top Candidates */}
                  <SectionCard
                    title="Top Candidates"
                    icon={<Star className="w-5 h-5" style={{ color: tokens.statusWarning }} />}
                    delay={0.3}
                  >
                    {topCandidates.length === 0 ? (
                      <EmptyState
                        icon={<Star className="w-8 h-8" style={{ color: tokens.textMuted }} />}
                        message="No candidates evaluated yet"
                      />
                    ) : (
                      <div className="space-y-3">
                        {topCandidates.map((candidate, index) => (
                          <TopCandidateCard
                            key={candidate.candidate_id}
                            candidate={candidate}
                            index={index}
                            onClick={() => router.push(`/candidates/${candidate.candidate_id}`)}
                          />
                        ))}
                      </div>
                    )}
                  </SectionCard>

                  {/* Recent Activity */}
                  <SectionCard
                    title="Recent Activity"
                    icon={<Activity className="w-5 h-5" style={{ color: tokens.textMuted }} />}
                    delay={0.35}
                  >
                    {activities.length === 0 ? (
                      <EmptyState
                        icon={<Activity className="w-8 h-8" style={{ color: tokens.textMuted }} />}
                        message="No recent activity"
                      />
                    ) : (
                      <div className="space-y-4">
                        {activities.map((activity, i) => (
                          <ActivityItem key={i} activity={activity} index={i} />
                        ))}
                      </div>
                    )}
                  </SectionCard>
                </div>
              </div>

              {/* Performance Summary */}
              {stats && (
                <div className="mt-8">
                  <PerformanceGrid stats={stats} />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
