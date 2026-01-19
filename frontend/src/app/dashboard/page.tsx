"use client";

import { useState, useEffect } from "react";
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
  BarChart3,
  Settings,
} from "lucide-react";
import UpcomingInterviews from "@/components/UpcomingInterviews";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { FadeInUp, Stagger, StaggerItem, Spinner } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

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

export default function DashboardPage() {
  const router = useRouter();
  const { currentRecruiter } = useRecruiter();
  const { isAuthenticated, isLoading: authLoading, token } = useAuth();

  const [stats, setStats] = useState<RecruiterStats | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [topCandidates, setTopCandidates] = useState<TopCandidate[]>([]);
  const [loading, setLoading] = useState(true);

  const getHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  };

  useEffect(() => {
    if (isAuthenticated && currentRecruiter) {
      fetchDashboardData();
    } else if (!authLoading && !currentRecruiter) {
      setLoading(false);
    }
  }, [isAuthenticated, currentRecruiter, authLoading]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const headers = getHeaders();

      const statsResponse = await fetch(
        `${API_URL}/api/recruiters/${currentRecruiter?.id}/stats`,
        { headers }
      );
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      const jobsResponse = await fetch(
        `${API_URL}/api/jobs/?recruiter_id=${currentRecruiter?.id}`,
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-7xl mx-auto">
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
              <Card variant="glass" padding="lg" className="text-center py-16">
                <motion.div
                  className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-6 border border-white/10"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  <BarChart3 className="w-10 h-10 text-indigo-400" />
                </motion.div>
                <h3 className="text-2xl font-bold text-white mb-3">
                  Welcome to Briefing Room
                </h3>
                <p className="text-zinc-400 max-w-md mx-auto">
                  Select or create a recruiter to view your dashboard and start managing your hiring pipeline.
                </p>
              </Card>
            </motion.div>
          ) : loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-20"
            >
              <Spinner size="lg" />
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
                    <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
                      Welcome back, {currentRecruiter.name.split(" ")[0]}
                    </h2>
                    <p className="text-zinc-400">
                      Here's an overview of your hiring pipeline
                    </p>
                  </div>
                  <Button
                    onClick={() => router.push("/jobs/new")}
                    leftIcon={<Plus className="w-4 h-4" />}
                    size="lg"
                  >
                    Create New Job
                  </Button>
                </div>
              </FadeInUp>

              {/* Stats Grid */}
              <FadeInUp delay={0.1}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  {[
                    {
                      icon: Briefcase,
                      value: stats?.active_jobs || 0,
                      label: "Active Jobs",
                      color: "indigo",
                    },
                    {
                      icon: Users,
                      value: stats?.total_candidates || 0,
                      label: "Candidates",
                      color: "purple",
                    },
                    {
                      icon: Target,
                      value: (stats?.strong_hires || 0) + (stats?.hires || 0),
                      label: "Hire Ready",
                      color: "emerald",
                    },
                    {
                      icon: TrendingUp,
                      value: `${stats?.hire_rate.toFixed(0) || 0}%`,
                      label: "Hire Rate",
                      color: "cyan",
                    },
                  ].map((stat) => (
                    <motion.div
                      key={stat.label}
                      whileHover={{ y: -2 }}
                      transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    >
                      <Card padding="md" className="h-full">
                        <div className="flex items-center gap-4">
                          <div
                            className={cn(
                              "p-3 rounded-xl",
                              stat.color === "indigo" && "bg-indigo-500/10",
                              stat.color === "purple" && "bg-purple-500/10",
                              stat.color === "emerald" && "bg-emerald-500/10",
                              stat.color === "cyan" && "bg-cyan-500/10"
                            )}
                          >
                            <stat.icon
                              className={cn(
                                "w-5 h-5",
                                stat.color === "indigo" && "text-indigo-400",
                                stat.color === "purple" && "text-purple-400",
                                stat.color === "emerald" && "text-emerald-400",
                                stat.color === "cyan" && "text-cyan-400"
                              )}
                            />
                          </div>
                          <div>
                            <p className="text-3xl font-light text-white tracking-tight">
                              {stat.value}
                            </p>
                            <p className="text-xs text-zinc-500 uppercase tracking-wider mt-0.5">
                              {stat.label}
                            </p>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </FadeInUp>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Jobs Section */}
                <FadeInUp delay={0.15} className="lg:col-span-2">
                  <Card padding="lg">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-medium text-white flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-zinc-500" />
                        Jobs
                      </h3>
                      <Link
                        href="/jobs"
                        className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                      >
                        View All
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>

                    {jobs.length === 0 ? (
                      <div className="text-center py-12">
                        <motion.div
                          className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center mx-auto mb-4 border border-white/5"
                          animate={{ y: [0, -4, 0] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <Briefcase className="w-8 h-8 text-indigo-400" />
                        </motion.div>
                        <p className="text-zinc-400 mb-4">No jobs yet</p>
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
                              className="flex items-center p-4 bg-white/[0.03] rounded-xl hover:bg-white/[0.06] transition-all cursor-pointer border border-white/[0.04] group"
                              whileHover={{ x: 4 }}
                              transition={{ type: "spring", stiffness: 400, damping: 25 }}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                  <h4 className="font-medium text-white group-hover:text-indigo-300 transition-colors">
                                    {job.title}
                                  </h4>
                                  <StatusBadge
                                    status={job.status as "active" | "draft" | "paused" | "closed"}
                                    size="sm"
                                  />
                                </div>
                                <div className="flex items-center gap-4 text-sm text-zinc-500">
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
                              <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
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
                    <Card padding="md">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-400">
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
                    <Card padding="lg">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-white flex items-center gap-2">
                          <Star className="w-5 h-5 text-yellow-400" />
                          Top Candidates
                        </h3>
                      </div>

                      {topCandidates.length === 0 ? (
                        <p className="text-zinc-500 text-sm text-center py-6">
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
                              className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl hover:bg-white/[0.06] transition-all cursor-pointer border border-white/[0.04] group"
                              whileHover={{ x: 2 }}
                            >
                              <UserAvatar
                                name={candidate.candidate_name || "?"}
                                size="sm"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-white text-sm truncate group-hover:text-indigo-300 transition-colors">
                                  {candidate.candidate_name || "Unknown"}
                                </div>
                                <div className="text-xs text-zinc-500 truncate">
                                  {candidate.job_title}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-light text-white">
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
                    <Card padding="lg">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-white flex items-center gap-2">
                          <Clock className="w-5 h-5 text-zinc-500" />
                          Recent Activity
                        </h3>
                      </div>

                      {activities.length === 0 ? (
                        <p className="text-zinc-500 text-sm text-center py-6">
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
                              <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-zinc-300">
                                  <span className="font-medium text-white">
                                    {activity.candidate_name}
                                  </span>{" "}
                                  interviewed for{" "}
                                  <span className="text-indigo-300">
                                    {activity.job_title}
                                  </span>
                                </p>
                                <p className="text-xs text-zinc-600 mt-0.5">
                                  {new Date(activity.timestamp).toLocaleDateString()}
                                </p>
                              </div>
                              {activity.score && (
                                <div className="text-zinc-400 font-medium">
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
                  <Card padding="lg" className="mt-8">
                    <h3 className="text-lg font-medium text-white mb-6">
                      Performance Summary
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                      {[
                        { value: stats.total_jobs, label: "Total Jobs" },
                        { value: stats.total_candidates, label: "Total Candidates" },
                        { value: stats.interviewed_candidates, label: "Interviewed" },
                        {
                          value: stats.strong_hires,
                          label: "Strong Hires",
                          color: "emerald",
                        },
                        { value: stats.avg_candidate_score.toFixed(0), label: "Avg Score" },
                        {
                          value: `${stats.hire_rate.toFixed(0)}%`,
                          label: "Hire Rate",
                          color: "cyan",
                        },
                      ].map((item, index) => (
                        <motion.div
                          key={item.label}
                          className="text-center"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.5 + index * 0.05 }}
                        >
                          <div
                            className={cn(
                              "text-3xl font-light tracking-tight",
                              item.color === "emerald"
                                ? "text-emerald-400"
                                : item.color === "cyan"
                                ? "text-cyan-400"
                                : "text-white"
                            )}
                          >
                            {item.value}
                          </div>
                          <div className="text-xs text-zinc-500 uppercase tracking-wider mt-1">
                            {item.label}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </Card>
                </FadeInUp>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
