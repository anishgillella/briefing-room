"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRecruiter } from "@/contexts/RecruiterContext";
import { useAuth } from "@/contexts/AuthContext";
import RecruiterSelector from "@/components/RecruiterSelector";
import AppLayout from "@/components/AppLayout";
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
  Calendar,
  CalendarDays,
  Settings,
} from "lucide-react";
import UpcomingInterviews from "@/components/UpcomingInterviews";

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

  // Helper to build auth headers using token from context
  const getHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  };

  // Auth redirect is handled by AppLayout

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

      // Fetch recruiter stats
      const statsResponse = await fetch(
        `${API_URL}/api/recruiters/${currentRecruiter?.id}/stats`,
        { headers }
      );
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      // Fetch recruiter's jobs (filtered by recruiter to avoid fetching all jobs)
      const jobsResponse = await fetch(
        `${API_URL}/api/jobs/?recruiter_id=${currentRecruiter?.id}`,
        { headers }
      );
      if (jobsResponse.ok) {
        const jobsData = await jobsResponse.json();
        // Sort by status (active first) and limit to 5
        const sortedJobs = jobsData.sort((a: Job, b: Job) => {
          if (a.status === "active" && b.status !== "active") return -1;
          if (a.status !== "active" && b.status === "active") return 1;
          return 0;
        });
        setJobs(sortedJobs.slice(0, 5));
      }

      // Fetch recent activity
      const activityResponse = await fetch(
        `${API_URL}/api/dashboard/activity?limit=5`,
        { headers }
      );
      if (activityResponse.ok) {
        const activityData = await activityResponse.json();
        setActivities(activityData.activities || []);
      }

      // Fetch top candidates
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

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case "strong_hire":
        return "text-green-400 bg-green-500/10";
      case "hire":
        return "text-blue-400 bg-blue-500/10";
      case "maybe":
        return "text-yellow-400 bg-yellow-500/10";
      case "no_hire":
        return "text-red-400 bg-red-500/10";
      default:
        return "text-white/40 bg-white/5";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/10 border-green-500/30 text-green-400";
      case "draft":
        return "bg-yellow-500/10 border-yellow-500/30 text-yellow-400";
      default:
        return "bg-gray-500/10 border-gray-500/30 text-gray-400";
    }
  };

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-7xl mx-auto">
        {/* Page Header with Recruiter Selector */}
        <div className="flex items-center justify-end mb-6">
          <RecruiterSelector />
        </div>
        {!currentRecruiter ? (
          <div className="glass-panel rounded-3xl p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center mx-auto mb-6">
              <BarChart3 className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">Welcome to Briefing Room</h3>
            <p className="text-white/50 mb-6">
              Select or create a recruiter to view your dashboard.
            </p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Welcome Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">
                  Welcome back, {currentRecruiter.name.split(" ")[0]}
                </h2>
                <p className="text-white/50">Here's an overview of your hiring pipeline</p>
              </div>
              <button
                onClick={() => router.push("/jobs/new")}
                className="flex items-center gap-2 px-5 py-3 bg-white text-black rounded-full font-medium hover:bg-gray-100 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create New Job
              </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="glass-panel rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                    <Briefcase className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-light text-white">{stats?.active_jobs || 0}</div>
                    <div className="text-xs text-white/50 uppercase tracking-wider">Active Jobs</div>
                  </div>
                </div>
              </div>

              <div className="glass-panel rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-light text-white">
                      {stats?.total_candidates || 0}
                    </div>
                    <div className="text-xs text-white/50 uppercase tracking-wider">Candidates</div>
                  </div>
                </div>
              </div>

              <div className="glass-panel rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <Target className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-light text-white">
                      {(stats?.strong_hires || 0) + (stats?.hires || 0)}
                    </div>
                    <div className="text-xs text-white/50 uppercase tracking-wider">Hire Ready</div>
                  </div>
                </div>
              </div>

              <div className="glass-panel rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-light text-white">
                      {stats?.hire_rate.toFixed(0) || 0}%
                    </div>
                    <div className="text-xs text-white/50 uppercase tracking-wider">Hire Rate</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Jobs */}
              <div className="lg:col-span-2 glass-panel rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-medium text-white flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-white/60" />
                    Jobs
                  </h3>
                  <Link
                    href="/jobs"
                    className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    View All
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>

                {jobs.length === 0 ? (
                  <div className="text-center py-8">
                    <Briefcase className="w-12 h-12 text-white/20 mx-auto mb-4" />
                    <p className="text-white/50 mb-4">No jobs yet</p>
                    <button
                      onClick={() => router.push("/jobs/new")}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Create Your First Job
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {jobs.map((job) => (
                      <div
                        key={job.id}
                        onClick={() => router.push(`/jobs/${job.id}`)}
                        className="flex items-center p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-white">{job.title}</h4>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider border ${getStatusColor(
                                job.status
                              )}`}
                            >
                              {job.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-white/50">
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              {job.candidate_count} candidates
                            </span>
                            <span className="flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" />
                              {job.interviewed_count} interviewed
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-white/30" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Upcoming Interviews */}
                <UpcomingInterviews limit={5} showHeader={true} />

                {/* Quick Actions */}
                <div className="glass-panel rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/60">Interviewer Availability</span>
                    <button
                      onClick={() => router.push("/dashboard/availability")}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-white/80 transition-colors"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      Manage
                    </button>
                  </div>
                </div>

                {/* Top Candidates */}
                <div className="glass-panel rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-white flex items-center gap-2">
                      <Star className="w-5 h-5 text-yellow-400" />
                      Top Candidates
                    </h3>
                  </div>

                  {topCandidates.length === 0 ? (
                    <p className="text-white/40 text-sm text-center py-4">
                      No candidates evaluated yet
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {topCandidates.map((candidate) => (
                        <div
                          key={candidate.candidate_id}
                          onClick={() => router.push(`/candidates/${candidate.candidate_id}`)}
                          className="flex items-center gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 text-sm">
                            {candidate.candidate_name?.charAt(0).toUpperCase() || "?"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-white text-sm truncate">
                              {candidate.candidate_name || "Unknown"}
                            </div>
                            <div className="text-xs text-white/40 truncate">
                              {candidate.job_title}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-light text-white">
                              {candidate.score.toFixed(0)}
                            </div>
                            <div
                              className={`text-[10px] px-2 py-0.5 rounded-full ${getRecommendationColor(
                                candidate.recommendation
                              )}`}
                            >
                              {candidate.recommendation.replace("_", " ")}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Activity */}
                <div className="glass-panel rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-white flex items-center gap-2">
                      <Clock className="w-5 h-5 text-white/60" />
                      Recent Activity
                    </h3>
                  </div>

                  {activities.length === 0 ? (
                    <p className="text-white/40 text-sm text-center py-4">No recent activity</p>
                  ) : (
                    <div className="space-y-3">
                      {activities.map((activity, i) => (
                        <div key={i} className="flex items-start gap-3 text-sm">
                          <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5" />
                          <div className="flex-1">
                            <p className="text-white/80">
                              <span className="font-medium text-white">
                                {activity.candidate_name}
                              </span>{" "}
                              interviewed for{" "}
                              <span className="text-indigo-300">{activity.job_title}</span>
                            </p>
                            <p className="text-xs text-white/40">
                              {new Date(activity.timestamp).toLocaleDateString()}
                            </p>
                          </div>
                          {activity.score && (
                            <div className="text-white/60">{activity.score.toFixed(0)}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Performance Summary */}
            {stats && (
              <div className="mt-8 glass-panel rounded-2xl p-6">
                <h3 className="text-lg font-medium text-white mb-6">Performance Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-light text-white">{stats.total_jobs}</div>
                    <div className="text-xs text-white/50 uppercase tracking-wider">Total Jobs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-light text-white">{stats.total_candidates}</div>
                    <div className="text-xs text-white/50 uppercase tracking-wider">
                      Total Candidates
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-light text-white">
                      {stats.interviewed_candidates}
                    </div>
                    <div className="text-xs text-white/50 uppercase tracking-wider">Interviewed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-light text-green-400">{stats.strong_hires}</div>
                    <div className="text-xs text-white/50 uppercase tracking-wider">Strong Hires</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-light text-white">
                      {stats.avg_candidate_score.toFixed(0)}
                    </div>
                    <div className="text-xs text-white/50 uppercase tracking-wider">Avg Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-light text-cyan-400">
                      {stats.hire_rate.toFixed(0)}%
                    </div>
                    <div className="text-xs text-white/50 uppercase tracking-wider">Hire Rate</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
