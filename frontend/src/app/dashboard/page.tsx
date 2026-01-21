"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRecruiter } from "@/contexts/RecruiterContext";
import { useAuth } from "@/contexts/AuthContext";
import RecruiterSelector from "@/components/RecruiterSelector";
import AppLayout from "@/components/AppLayout";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
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
  Settings,
  Sparkles,
  ArrowUpRight,
  Zap,
  Search,
} from "lucide-react";
import UpcomingInterviews from "@/components/UpcomingInterviews";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { FadeInUp, Stagger, StaggerItem, Spinner } from "@/components/ui/motion";
import { cn } from "@/lib/utils";
import { tokens, springConfig, easeOutCustom } from "@/lib/design-tokens";

// Dynamic import for 3D scene - disabled for dark theme
const DashboardScene = dynamic(() => import("@/components/three/DashboardScene"), {
  ssr: false,
  loading: () => null,
});

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

// Animated counter component with reduced motion support
function AnimatedNumber({ value, suffix = "" }: { value: number | string; suffix?: string }) {
  const prefersReducedMotion = useReducedMotion();
  const numericValue = typeof value === "string" ? parseFloat(value) : value;
  const [displayValue, setDisplayValue] = useState(prefersReducedMotion ? numericValue : 0);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayValue(numericValue);
      return;
    }

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
  }, [numericValue, prefersReducedMotion]);

  return (
    <span style={{ fontFamily: "var(--font-mono), monospace" }}>
      {typeof value === "string" && value.includes("%")
        ? `${displayValue.toFixed(0)}%`
        : displayValue.toFixed(0)}
      {suffix}
    </span>
  );
}

// Premium stat card with dark theme
function StatCard({
  icon: Icon,
  value,
  label,
  variant = "default",
  delay = 0,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number | string;
  label: string;
  variant?: "default" | "success" | "warning" | "brand";
  delay?: number;
}) {
  const prefersReducedMotion = useReducedMotion();

  const variantStyles = {
    default: {
      iconBg: "rgba(255,255,255,0.05)",
      iconColor: tokens.textMuted,
      glow: "transparent",
    },
    success: {
      iconBg: "rgba(16,185,129,0.15)",
      iconColor: tokens.statusSuccess,
      glow: "rgba(16,185,129,0.1)",
    },
    warning: {
      iconBg: "rgba(245,158,11,0.15)",
      iconColor: tokens.statusWarning,
      glow: "rgba(245,158,11,0.1)",
    },
    brand: {
      iconBg: tokens.brandGlow,
      iconColor: tokens.brandSecondary,
      glow: tokens.brandGlow,
    },
  };

  const styles = variantStyles[variant];

  return (
    <motion.div
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? {} : { delay, ...springConfig }}
      whileHover={prefersReducedMotion ? {} : { y: -4, scale: 1.02 }}
      className="group"
    >
      <div
        className="relative p-6 rounded-2xl transition-all duration-300"
        style={{
          background: tokens.bgCard,
          border: `1px solid ${tokens.borderSubtle}`,
          boxShadow: `0 0 30px ${styles.glow}`,
        }}
      >
        {/* Gradient overlay on hover */}
        <div
          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: `linear-gradient(135deg, ${styles.glow} 0%, transparent 100%)` }}
        />

        <div className="relative flex items-center gap-4">
          <motion.div
            className="p-3 rounded-xl"
            style={{ background: styles.iconBg }}
            whileHover={prefersReducedMotion ? {} : { rotate: 5, scale: 1.1 }}
            transition={springConfig}
          >
            <Icon className="w-6 h-6" style={{ color: styles.iconColor }} />
          </motion.div>
          <div>
            <p
              className="text-3xl font-bold tracking-tight"
              style={{ color: tokens.textPrimary }}
            >
              <AnimatedNumber value={value} />
            </p>
            <p className="text-sm font-medium mt-0.5" style={{ color: tokens.textMuted }}>
              {label}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const { currentRecruiter } = useRecruiter();
  const { isAuthenticated, isLoading: authLoading, token } = useAuth();

  const [stats, setStats] = useState<RecruiterStats | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [topCandidates, setTopCandidates] = useState<TopCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Track if we've already fetched for this recruiter to prevent duplicate calls
  const fetchedForRecruiterRef = useRef<string | null>(null);

  const getHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }, [token]);

  const fetchDashboardData = useCallback(async (recruiterId: string) => {
    // Prevent duplicate fetches for the same recruiter
    if (fetchedForRecruiterRef.current === recruiterId) {
      return;
    }
    fetchedForRecruiterRef.current = recruiterId;

    try {
      setLoading(true);
      const headers = getHeaders();

      const statsResponse = await fetch(
        `${API_URL}/api/recruiters/${recruiterId}/stats`,
        { headers }
      );
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      // Re-enabled counts with batch query optimization
      const jobsResponse = await fetch(
        `${API_URL}/api/jobs/?recruiter_id=${recruiterId}&include_counts=true`,
        { headers }
      );
      if (jobsResponse.ok) {
        const jobsData = await jobsResponse.json();
        const sortedJobs = jobsData.sort((a: Job, b: Job) => {
          if (a.status === "active" && b.status !== "active") return -1;
          if (a.status !== "active" && b.status === "active") return 1;
          return 0;
        });
        setJobs(sortedJobs.slice(0, 5));
      }

      const activityResponse = await fetch(
        `${API_URL}/api/dashboard/activity?limit=5`,
        { headers }
      );
      if (activityResponse.ok) {
        const activityData = await activityResponse.json();
        setActivities(activityData.activities || []);
      }

      const topResponse = await fetch(
        `${API_URL}/api/dashboard/top-candidates?limit=5`,
        { headers }
      );
      if (topResponse.ok) {
        const topData = await topResponse.json();
        setTopCandidates(topData.candidates || []);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      // Reset the ref so we can retry on error
      fetchedForRecruiterRef.current = null;
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    if (isAuthenticated && currentRecruiter?.id) {
      // Reset ref when recruiter changes
      if (fetchedForRecruiterRef.current !== currentRecruiter.id) {
        fetchedForRecruiterRef.current = null;
      }
      fetchDashboardData(currentRecruiter.id);
    } else if (!authLoading && !currentRecruiter) {
      setLoading(false);
    }
  }, [isAuthenticated, currentRecruiter?.id, authLoading, fetchDashboardData]);

  // Filter jobs by search term
  const filteredJobs = jobs.filter((job) =>
    job.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColors = (status: string) => {
    switch (status) {
      case "active":
        return { bg: "rgba(16,185,129,0.15)", text: tokens.statusSuccess, border: "rgba(16,185,129,0.3)" };
      case "draft":
        return { bg: "rgba(255,255,255,0.05)", text: tokens.textMuted, border: tokens.borderSubtle };
      case "paused":
        return { bg: "rgba(245,158,11,0.15)", text: tokens.statusWarning, border: "rgba(245,158,11,0.3)" };
      case "closed":
        return { bg: "rgba(239,68,68,0.15)", text: tokens.statusDanger, border: "rgba(239,68,68,0.3)" };
      default:
        return { bg: "rgba(255,255,255,0.05)", text: tokens.textMuted, border: tokens.borderSubtle };
    }
  };

  return (
    <AppLayout>
      {/* Premium Dark Background */}
      <div className="min-h-screen" style={{ background: tokens.bgApp }}>
        {/* Ambient Background Effects */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute top-0 left-1/4 w-[800px] h-[800px] rounded-full blur-[120px] opacity-30"
            style={{ background: tokens.brandGlow }}
          />
          <div
            className="absolute bottom-0 right-1/4 w-[600px] h-[600px] rounded-full blur-[100px] opacity-20"
            style={{ background: "rgba(139,92,246,0.15)" }}
          />
          <div
            className="absolute top-1/2 right-0 w-[400px] h-[400px] rounded-full blur-[80px] opacity-15"
            style={{ background: "rgba(16,185,129,0.15)" }}
          />
        </div>

        <div className="relative px-6 py-8 max-w-7xl mx-auto">
          {/* Page Header with Recruiter Selector */}
          <FadeInUp>
            <div className="flex items-center justify-end mb-6">
              <RecruiterSelector />
            </div>
          </FadeInUp>

          <AnimatePresence mode="wait">
            {!currentRecruiter ? (
              <motion.div
                key="no-recruiter"
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? {} : { opacity: 0 }}
              >
                <div className="relative">
                  {/* Glow effect */}
                  <div
                    className="absolute -inset-1 rounded-3xl blur-xl opacity-60"
                    style={{ background: `linear-gradient(135deg, ${tokens.brandGlow} 0%, transparent 50%, rgba(139,92,246,0.15) 100%)` }}
                  />

                  <div
                    className="relative text-center py-16 rounded-3xl backdrop-blur-xl"
                    style={{ background: tokens.bgCard, border: `1px solid ${tokens.borderSubtle}` }}
                  >
                    <motion.div
                      className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl"
                      style={{ background: tokens.gradientPrimary, boxShadow: `0 20px 40px ${tokens.brandGlow}` }}
                      animate={prefersReducedMotion ? {} : { y: [0, -8, 0] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <Sparkles className="w-10 h-10" style={{ color: tokens.textPrimary }} />
                    </motion.div>
                    <h3 className="text-2xl font-bold mb-3" style={{ color: tokens.textPrimary }}>
                      Welcome to Briefing Room
                    </h3>
                    <p style={{ color: tokens.textMuted }} className="max-w-md mx-auto">
                      Select or create a recruiter to view your dashboard and start managing your hiring pipeline.
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : loading ? (
              <motion.div
                key="loading"
                initial={prefersReducedMotion ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={prefersReducedMotion ? {} : { opacity: 0 }}
                className="flex items-center justify-center py-20"
              >
                <div className="text-center">
                  <Spinner size="lg" />
                  <p className="mt-4" style={{ color: tokens.textMuted }}>
                    Loading your dashboard...
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="dashboard"
                initial={prefersReducedMotion ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={prefersReducedMotion ? {} : { opacity: 0 }}
              >
                {/* Welcome Header */}
                <FadeInUp>
                  <div className="flex items-start justify-between mb-8">
                    <div>
                      <motion.div
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold mb-3"
                        style={{
                          background: tokens.brandGlow,
                          border: `1px solid ${tokens.brandPrimary}40`,
                          color: tokens.brandSecondary,
                        }}
                        initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 }}
                      >
                        <Zap className="w-3.5 h-3.5" />
                        AI-Powered Insights
                      </motion.div>
                      <h2
                        className="text-3xl font-bold mb-2 tracking-tight"
                        style={{ color: tokens.textPrimary }}
                      >
                        Welcome back, {currentRecruiter.name.split(" ")[0]}
                      </h2>
                      <p style={{ color: tokens.textMuted }}>
                        Here&apos;s an overview of your hiring pipeline
                      </p>
                    </div>
                    <motion.div
                      whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                      whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
                    >
                      <Button
                        onClick={() => router.push("/jobs/new")}
                        leftIcon={<Plus className="w-4 h-4" />}
                        size="lg"
                        className="shadow-lg"
                        style={{ boxShadow: `0 10px 30px ${tokens.brandGlow}` }}
                      >
                        Create New Job
                      </Button>
                    </motion.div>
                  </div>
                </FadeInUp>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  <StatCard
                    icon={Briefcase}
                    value={stats?.total_jobs || 0}
                    label="Total Jobs"
                    variant="brand"
                    delay={0.1}
                  />
                  <StatCard
                    icon={Users}
                    value={stats?.total_candidates || 0}
                    label="Candidates"
                    variant="default"
                    delay={0.15}
                  />
                  <StatCard
                    icon={Target}
                    value={(stats?.strong_hires || 0) + (stats?.hires || 0)}
                    label="Hire Ready"
                    variant="success"
                    delay={0.2}
                  />
                  <StatCard
                    icon={TrendingUp}
                    value={`${stats?.hire_rate.toFixed(0) || 0}%`}
                    label="Hire Rate"
                    variant="warning"
                    delay={0.25}
                  />
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Jobs Section */}
                  <FadeInUp delay={0.15} className="lg:col-span-2">
                    <div
                      className="rounded-3xl p-6"
                      style={{ background: tokens.bgCard, border: `1px solid ${tokens.borderSubtle}` }}
                    >
                      <div className="flex items-center justify-between mb-6">
                        <h3
                          className="text-lg font-semibold flex items-center gap-2"
                          style={{ color: tokens.textPrimary }}
                        >
                          <Briefcase className="w-5 h-5" style={{ color: tokens.textMuted }} />
                          Jobs
                        </h3>
                        <Link
                          href="/jobs"
                          className="text-sm flex items-center gap-1 transition-colors font-medium"
                          style={{ color: tokens.brandSecondary }}
                        >
                          View All
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>

                      {/* Search Bar */}
                      <div className="mb-4">
                        <div
                          className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                          style={{
                            background: "rgba(255,255,255,0.03)",
                            border: `1px solid ${tokens.borderSubtle}`,
                          }}
                        >
                          <Search className="w-4 h-4" style={{ color: tokens.textDisabled }} />
                          <input
                            type="text"
                            placeholder="Search jobs..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-1 bg-transparent outline-none text-sm"
                            style={{ color: tokens.textPrimary }}
                          />
                          <span
                            className="text-xs px-2 py-0.5 rounded"
                            style={{ background: "rgba(255,255,255,0.05)", color: tokens.textDisabled }}
                          >
                            {filteredJobs.length}
                          </span>
                        </div>
                      </div>

                      {filteredJobs.length === 0 ? (
                        <div className="text-center py-12">
                          <motion.div
                            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                            style={{
                              background: tokens.brandGlow,
                              border: `1px solid ${tokens.brandPrimary}40`,
                            }}
                            animate={prefersReducedMotion ? {} : { y: [0, -4, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          >
                            <Briefcase className="w-8 h-8" style={{ color: tokens.brandSecondary }} />
                          </motion.div>
                          <p className="mb-4" style={{ color: tokens.textMuted }}>
                            {searchTerm ? "No jobs match your search" : "No jobs yet"}
                          </p>
                          {!searchTerm && (
                            <Button
                              onClick={() => router.push("/jobs/new")}
                              leftIcon={<Plus className="w-4 h-4" />}
                            >
                              Create Your First Job
                            </Button>
                          )}
                        </div>
                      ) : (
                        <Stagger className="space-y-3">
                          {filteredJobs.map((job) => {
                            const statusColors = getStatusColors(job.status);
                            return (
                              <StaggerItem key={job.id}>
                                <motion.div
                                  onClick={() => router.push(`/jobs/${job.id}`)}
                                  className="flex items-center p-4 rounded-xl transition-all cursor-pointer group"
                                  style={{
                                    background: "rgba(255,255,255,0.02)",
                                    border: `1px solid ${tokens.borderSubtle}`,
                                  }}
                                  whileHover={prefersReducedMotion ? {} : { x: 4, background: "rgba(255,255,255,0.05)" }}
                                  transition={springConfig}
                                >
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-1">
                                      <h4
                                        className="font-medium transition-colors"
                                        style={{ color: tokens.textPrimary }}
                                      >
                                        {job.title}
                                      </h4>
                                      <span
                                        className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                                        style={{
                                          background: statusColors.bg,
                                          color: statusColors.text,
                                          border: `1px solid ${statusColors.border}`,
                                        }}
                                      >
                                        {job.status}
                                      </span>
                                    </div>
                                    <div
                                      className="flex items-center gap-4 text-sm"
                                      style={{ color: tokens.textMuted }}
                                    >
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
                                    className="w-5 h-5 transition-colors"
                                    style={{ color: tokens.textDisabled }}
                                  />
                                </motion.div>
                              </StaggerItem>
                            );
                          })}
                        </Stagger>
                      )}
                    </div>
                  </FadeInUp>

                  {/* Right Column */}
                  <div className="space-y-6">
                    {/* Upcoming Interviews */}
                    <FadeInUp delay={0.2}>
                      <UpcomingInterviews limit={5} showHeader={true} />
                    </FadeInUp>

                    {/* Quick Actions */}
                    <FadeInUp delay={0.25}>
                      <div
                        className="p-4 rounded-2xl"
                        style={{ background: tokens.bgCard, border: `1px solid ${tokens.borderSubtle}` }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm" style={{ color: tokens.textMuted }}>
                            Interviewer Availability
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push("/dashboard/availability")}
                            leftIcon={<Settings className="w-3.5 h-3.5" />}
                          >
                            Manage
                          </Button>
                        </div>
                      </div>
                    </FadeInUp>

                    {/* Top Candidates */}
                    <FadeInUp delay={0.3}>
                      <div
                        className="p-6 rounded-3xl"
                        style={{ background: tokens.bgCard, border: `1px solid ${tokens.borderSubtle}` }}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h3
                            className="text-lg font-semibold flex items-center gap-2"
                            style={{ color: tokens.textPrimary }}
                          >
                            <Star className="w-5 h-5" style={{ color: tokens.statusWarning }} />
                            Top Candidates
                          </h3>
                        </div>

                        {topCandidates.length === 0 ? (
                          <p
                            className="text-sm text-center py-6"
                            style={{ color: tokens.textMuted }}
                          >
                            No candidates evaluated yet
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {topCandidates.map((candidate) => (
                              <motion.div
                                key={candidate.candidate_id}
                                onClick={() =>
                                  router.push(`/candidates/${candidate.candidate_id}`)
                                }
                                className="flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer group"
                                style={{
                                  background: "rgba(255,255,255,0.02)",
                                  border: `1px solid ${tokens.borderSubtle}`,
                                }}
                                whileHover={prefersReducedMotion ? {} : { x: 2 }}
                              >
                                <UserAvatar
                                  name={candidate.candidate_name || "?"}
                                  size="sm"
                                />
                                <div className="flex-1 min-w-0">
                                  <div
                                    className="font-medium text-sm truncate transition-colors"
                                    style={{ color: tokens.textPrimary }}
                                  >
                                    {candidate.candidate_name || "Unknown"}
                                  </div>
                                  <div
                                    className="text-xs truncate"
                                    style={{ color: tokens.textMuted }}
                                  >
                                    {candidate.job_title}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div
                                    className="text-lg font-semibold"
                                    style={{
                                      color:
                                        candidate.score >= 80
                                          ? tokens.statusSuccess
                                          : candidate.score >= 60
                                          ? tokens.statusWarning
                                          : tokens.textPrimary,
                                      fontFamily: "var(--font-mono), monospace",
                                    }}
                                  >
                                    {candidate.score.toFixed(0)}
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </div>
                    </FadeInUp>

                    {/* Recent Activity */}
                    <FadeInUp delay={0.35}>
                      <div
                        className="p-6 rounded-3xl"
                        style={{ background: tokens.bgCard, border: `1px solid ${tokens.borderSubtle}` }}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h3
                            className="text-lg font-semibold flex items-center gap-2"
                            style={{ color: tokens.textPrimary }}
                          >
                            <Clock className="w-5 h-5" style={{ color: tokens.textMuted }} />
                            Recent Activity
                          </h3>
                        </div>

                        {activities.length === 0 ? (
                          <p
                            className="text-sm text-center py-6"
                            style={{ color: tokens.textMuted }}
                          >
                            No recent activity
                          </p>
                        ) : (
                          <div className="space-y-4">
                            {activities.map((activity, i) => (
                              <motion.div
                                key={i}
                                className="flex items-start gap-3 text-sm"
                                initial={prefersReducedMotion ? {} : { opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                              >
                                <div
                                  className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                                  style={{ background: tokens.brandPrimary }}
                                />
                                <div className="flex-1 min-w-0">
                                  <p style={{ color: tokens.textSecondary }}>
                                    <span
                                      className="font-medium"
                                      style={{ color: tokens.textPrimary }}
                                    >
                                      {activity.candidate_name}
                                    </span>{" "}
                                    interviewed for{" "}
                                    <span
                                      className="font-medium"
                                      style={{ color: tokens.brandSecondary }}
                                    >
                                      {activity.job_title}
                                    </span>
                                  </p>
                                  <p
                                    className="text-xs mt-0.5"
                                    style={{ color: tokens.textDisabled }}
                                  >
                                    {new Date(activity.timestamp).toLocaleDateString()}
                                  </p>
                                </div>
                                {activity.score && (
                                  <div
                                    className="font-semibold"
                                    style={{
                                      color: tokens.textMuted,
                                      fontFamily: "var(--font-mono), monospace",
                                    }}
                                  >
                                    {activity.score.toFixed(0)}
                                  </div>
                                )}
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </div>
                    </FadeInUp>
                  </div>
                </div>

                {/* Performance Summary */}
                {stats && (
                  <FadeInUp delay={0.4}>
                    <div className="relative mt-8">
                      {/* Glow effect */}
                      <div
                        className="absolute -inset-1 rounded-3xl blur-xl opacity-40"
                        style={{ background: `linear-gradient(135deg, ${tokens.brandGlow} 0%, transparent 50%, rgba(139,92,246,0.15) 100%)` }}
                      />

                      <div
                        className="relative p-6 rounded-3xl"
                        style={{ background: tokens.bgCard, border: `1px solid ${tokens.borderSubtle}` }}
                      >
                        <h3
                          className="text-lg font-semibold mb-6"
                          style={{ color: tokens.textPrimary }}
                        >
                          Performance Summary
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                          {[
                            { value: stats.total_jobs, label: "Total Jobs", color: tokens.textPrimary },
                            { value: stats.total_candidates, label: "Total Candidates", color: tokens.textPrimary },
                            { value: stats.interviewed_candidates, label: "Interviewed", color: tokens.textPrimary },
                            { value: stats.strong_hires, label: "Strong Hires", color: tokens.statusSuccess },
                            { value: stats.avg_candidate_score.toFixed(0), label: "Avg Score", color: tokens.textPrimary },
                            { value: `${stats.hire_rate.toFixed(0)}%`, label: "Hire Rate", color: tokens.brandSecondary },
                          ].map((item, index) => (
                            <motion.div
                              key={item.label}
                              className="text-center p-4 rounded-xl"
                              style={{
                                background: "rgba(255,255,255,0.02)",
                                border: `1px solid ${tokens.borderSubtle}`,
                              }}
                              initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.5 + index * 0.05 }}
                              whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
                            >
                              <div
                                className="text-3xl font-semibold tracking-tight"
                                style={{ color: item.color, fontFamily: "var(--font-mono), monospace" }}
                              >
                                {item.value}
                              </div>
                              <div
                                className="text-xs uppercase tracking-wider mt-1"
                                style={{ color: tokens.textDisabled }}
                              >
                                {item.label}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </FadeInUp>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Grain texture overlay */}
        <div
          className="fixed inset-0 pointer-events-none z-[100] opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>
    </AppLayout>
  );
}
