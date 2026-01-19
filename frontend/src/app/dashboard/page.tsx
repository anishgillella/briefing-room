"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
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
  BarChart3,
  Settings,
  Sparkles,
  ArrowUpRight,
  Zap,
} from "lucide-react";
import UpcomingInterviews from "@/components/UpcomingInterviews";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { FadeInUp, Stagger, StaggerItem, Spinner } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

// Dynamic import for 3D scene
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

// Animated counter component
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

// Stat card with animation
function StatCard({
  icon: Icon,
  value,
  label,
  color,
  delay = 0,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number | string;
  label: string;
  color: "indigo" | "rose" | "emerald" | "violet";
  delay?: number;
}) {
  const colorClasses = {
    indigo: {
      bg: "bg-indigo-100",
      icon: "text-indigo-600",
      border: "border-indigo-200",
      glow: "shadow-indigo-200/50",
    },
    rose: {
      bg: "bg-rose-100",
      icon: "text-rose-600",
      border: "border-rose-200",
      glow: "shadow-rose-200/50",
    },
    emerald: {
      bg: "bg-emerald-100",
      icon: "text-emerald-600",
      border: "border-emerald-200",
      glow: "shadow-emerald-200/50",
    },
    violet: {
      bg: "bg-violet-100",
      icon: "text-violet-600",
      border: "border-violet-200",
      glow: "shadow-violet-200/50",
    },
  };

  const classes = colorClasses[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring" as const, stiffness: 100, damping: 15 }}
      whileHover={{ y: -4, scale: 1.02 }}
      className="group"
    >
      <div
        className={cn(
          "relative p-6 rounded-2xl bg-white border transition-all duration-300",
          classes.border,
          "hover:shadow-lg",
          classes.glow
        )}
      >
        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-transparent to-slate-50/50 opacity-0 group-hover:opacity-100 transition-opacity" />

        <div className="relative flex items-center gap-4">
          <motion.div
            className={cn("p-3 rounded-xl", classes.bg)}
            whileHover={{ rotate: 5, scale: 1.1 }}
            transition={{ type: "spring" as const, stiffness: 400, damping: 17 }}
          >
            <Icon className={cn("w-6 h-6", classes.icon)} />
          </motion.div>
          <div>
            <p className="text-3xl font-bold text-slate-800 tracking-tight">
              <AnimatedNumber value={value} />
            </p>
            <p className="text-sm font-medium text-slate-600 mt-0.5">{label}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { currentRecruiter } = useRecruiter();
  const { isAuthenticated, isLoading: authLoading, token } = useAuth();

  const [stats, setStats] = useState<RecruiterStats | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [topCandidates, setTopCandidates] = useState<TopCandidate[]>([]);
  const [loading, setLoading] = useState(true);

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

      const jobsResponse = await fetch(
        `${API_URL}/api/jobs/?recruiter_id=${recruiterId}`,
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

  return (
    <AppLayout>
      {/* 3D Background */}
      <DashboardScene />

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
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className="relative">
                {/* Glow effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 via-transparent to-rose-500/20 rounded-3xl blur-xl opacity-60" />

                <Card variant="glass" padding="lg" className="relative text-center py-16 bg-white/80 backdrop-blur-xl">
                  <motion.div
                    className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-500/30"
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Sparkles className="w-10 h-10 text-white" />
                  </motion.div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-3">
                    Welcome to Briefing Room
                  </h3>
                  <p className="text-slate-500 max-w-md mx-auto">
                    Select or create a recruiter to view your dashboard and start managing your hiring pipeline.
                  </p>
                </Card>
              </div>
            </motion.div>
          ) : loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-20"
            >
              <div className="text-center">
                <Spinner size="lg" />
                <p className="text-slate-500 mt-4">Loading your dashboard...</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Welcome Header */}
              <FadeInUp>
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <motion.div
                      className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-700 text-sm font-semibold mb-3"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 }}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      AI-Powered Insights
                    </motion.div>
                    <h2 className="text-3xl font-bold text-slate-800 mb-2 tracking-tight">
                      Welcome back, {currentRecruiter.name.split(" ")[0]}
                    </h2>
                    <p className="text-slate-500">
                      Here's an overview of your hiring pipeline
                    </p>
                  </div>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      onClick={() => router.push("/jobs/new")}
                      leftIcon={<Plus className="w-4 h-4" />}
                      size="lg"
                      className="shadow-lg shadow-indigo-500/30"
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
                  value={stats?.active_jobs || 0}
                  label="Active Jobs"
                  color="indigo"
                  delay={0.1}
                />
                <StatCard
                  icon={Users}
                  value={stats?.total_candidates || 0}
                  label="Candidates"
                  color="rose"
                  delay={0.15}
                />
                <StatCard
                  icon={Target}
                  value={(stats?.strong_hires || 0) + (stats?.hires || 0)}
                  label="Hire Ready"
                  color="emerald"
                  delay={0.2}
                />
                <StatCard
                  icon={TrendingUp}
                  value={`${stats?.hire_rate.toFixed(0) || 0}%`}
                  label="Hire Rate"
                  color="violet"
                  delay={0.25}
                />
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Jobs Section */}
                <FadeInUp delay={0.15} className="lg:col-span-2">
                  <Card padding="lg" className="bg-white/90 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-slate-400" />
                        Jobs
                      </h3>
                      <Link
                        href="/jobs"
                        className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors font-medium"
                      >
                        View All
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>

                    {jobs.length === 0 ? (
                      <div className="text-center py-12">
                        <motion.div
                          className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center mx-auto mb-4 border border-indigo-200"
                          animate={{ y: [0, -4, 0] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <Briefcase className="w-8 h-8 text-indigo-600" />
                        </motion.div>
                        <p className="text-slate-500 mb-4">No jobs yet</p>
                        <Button
                          onClick={() => router.push("/jobs/new")}
                          leftIcon={<Plus className="w-4 h-4" />}
                        >
                          Create Your First Job
                        </Button>
                      </div>
                    ) : (
                      <Stagger className="space-y-3">
                        {jobs.map((job) => (
                          <StaggerItem key={job.id}>
                            <motion.div
                              onClick={() => router.push(`/jobs/${job.id}`)}
                              className="flex items-center p-4 bg-slate-50/80 rounded-xl hover:bg-slate-100 transition-all cursor-pointer border border-slate-100 group"
                              whileHover={{ x: 4 }}
                              transition={{ type: "spring" as const, stiffness: 400, damping: 25 }}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                  <h4 className="font-medium text-slate-900 group-hover:text-indigo-600 transition-colors">
                                    {job.title}
                                  </h4>
                                  <StatusBadge
                                    status={job.status as "active" | "draft" | "paused" | "closed"}
                                    size="sm"
                                  />
                                </div>
                                <div className="flex items-center gap-4 text-sm text-slate-500">
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
                              <ArrowUpRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                            </motion.div>
                          </StaggerItem>
                        ))}
                      </Stagger>
                    )}
                  </Card>
                </FadeInUp>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Upcoming Interviews */}
                  <FadeInUp delay={0.2}>
                    <UpcomingInterviews limit={5} showHeader={true} />
                  </FadeInUp>

                  {/* Quick Actions */}
                  <FadeInUp delay={0.25}>
                    <Card padding="md" className="bg-white/90 backdrop-blur-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">
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
                    </Card>
                  </FadeInUp>

                  {/* Top Candidates */}
                  <FadeInUp delay={0.3}>
                    <Card padding="lg" className="bg-white/90 backdrop-blur-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                          <Star className="w-5 h-5 text-yellow-500" />
                          Top Candidates
                        </h3>
                      </div>

                      {topCandidates.length === 0 ? (
                        <p className="text-slate-500 text-sm text-center py-6">
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
                              className="flex items-center gap-3 p-3 bg-slate-50/80 rounded-xl hover:bg-slate-100 transition-all cursor-pointer border border-slate-100 group"
                              whileHover={{ x: 2 }}
                            >
                              <UserAvatar
                                name={candidate.candidate_name || "?"}
                                size="sm"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-slate-900 text-sm truncate group-hover:text-indigo-600 transition-colors">
                                  {candidate.candidate_name || "Unknown"}
                                </div>
                                <div className="text-xs text-slate-500 truncate">
                                  {candidate.job_title}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-semibold text-slate-900">
                                  {candidate.score.toFixed(0)}
                                </div>
                                <StatusBadge
                                  status={
                                    candidate.recommendation === "strong_hire"
                                      ? "active"
                                      : candidate.recommendation === "hire"
                                      ? "active"
                                      : candidate.recommendation === "maybe"
                                      ? "paused"
                                      : "closed"
                                  }
                                  size="sm"
                                />
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </Card>
                  </FadeInUp>

                  {/* Recent Activity */}
                  <FadeInUp delay={0.35}>
                    <Card padding="lg" className="bg-white/90 backdrop-blur-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                          <Clock className="w-5 h-5 text-slate-400" />
                          Recent Activity
                        </h3>
                      </div>

                      {activities.length === 0 ? (
                        <p className="text-slate-500 text-sm text-center py-6">
                          No recent activity
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {activities.map((activity, i) => (
                            <motion.div
                              key={i}
                              className="flex items-start gap-3 text-sm"
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                            >
                              <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-slate-600">
                                  <span className="font-medium text-slate-900">
                                    {activity.candidate_name}
                                  </span>{" "}
                                  interviewed for{" "}
                                  <span className="text-indigo-600 font-medium">
                                    {activity.job_title}
                                  </span>
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {new Date(activity.timestamp).toLocaleDateString()}
                                </p>
                              </div>
                              {activity.score && (
                                <div className="text-slate-500 font-semibold">
                                  {activity.score.toFixed(0)}
                                </div>
                              )}
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </Card>
                  </FadeInUp>
                </div>
              </div>

              {/* Performance Summary */}
              {stats && (
                <FadeInUp delay={0.4}>
                  <div className="relative mt-8">
                    {/* Glow effect */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/15 via-transparent to-rose-500/15 rounded-3xl blur-xl opacity-60" />

                    <Card padding="lg" className="relative bg-white/90 backdrop-blur-sm">
                      <h3 className="text-lg font-semibold text-slate-900 mb-6">
                        Performance Summary
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                        {[
                          { value: stats.total_jobs, label: "Total Jobs", color: "text-slate-900" },
                          { value: stats.total_candidates, label: "Total Candidates", color: "text-slate-900" },
                          { value: stats.interviewed_candidates, label: "Interviewed", color: "text-slate-900" },
                          {
                            value: stats.strong_hires,
                            label: "Strong Hires",
                            color: "text-emerald-600",
                          },
                          { value: stats.avg_candidate_score.toFixed(0), label: "Avg Score", color: "text-slate-900" },
                          {
                            value: `${stats.hire_rate.toFixed(0)}%`,
                            label: "Hire Rate",
                            color: "text-indigo-600",
                          },
                        ].map((item, index) => (
                          <motion.div
                            key={item.label}
                            className="text-center p-4 rounded-xl bg-slate-50/80 border border-slate-100"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 + index * 0.05 }}
                            whileHover={{ scale: 1.05 }}
                          >
                            <div className={cn("text-3xl font-semibold tracking-tight", item.color)}>
                              {item.value}
                            </div>
                            <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">
                              {item.label}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </Card>
                  </div>
                </FadeInUp>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
