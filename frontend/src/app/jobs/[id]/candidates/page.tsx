"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowLeft,
  Users,
  Search,
  Filter,
  ChevronRight,
  Play,
  CheckCircle,
  Clock,
  Star,
  AlertCircle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Job {
  id: string;
  title: string;
  status: string;
}

interface Candidate {
  id: string;
  person_name: string;
  person_email?: string;
  email?: string;
  pipeline_status: string;
  interview_status: string;
  ranking_score?: number;
  combined_score?: number;
  screening_notes?: string;
  current_title?: string;
  current_company?: string;
  created_at: string;
}

// Parse screening notes to get recommendation
const getRecommendation = (candidate: Candidate): string | null => {
  if (!candidate.screening_notes) return null;
  try {
    const notes = typeof candidate.screening_notes === 'string'
      ? JSON.parse(candidate.screening_notes)
      : candidate.screening_notes;
    return notes.recommendation || null;
  } catch {
    return null;
  }
};

// Get fit badge color
const getFitBadgeStyle = (recommendation: string | null) => {
  switch (recommendation) {
    case "Strong Fit":
      return "bg-green-500/20 border-green-500/40 text-green-400";
    case "Good Fit":
      return "bg-blue-500/20 border-blue-500/40 text-blue-400";
    case "Potential Fit":
      return "bg-yellow-500/20 border-yellow-500/40 text-yellow-400";
    case "Not a Fit":
      return "bg-red-500/20 border-red-500/40 text-red-400";
    default:
      return "bg-gray-500/20 border-gray-500/40 text-gray-400";
  }
};

interface Analytics {
  overall_score: number;
  recommendation: string;
}

export default function JobCandidatesPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, token } = useAuth();

  const [job, setJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"score" | "fit" | "name" | "date">("score");

  // Helper to get fit rank (lower is better)
  const getFitRank = (recommendation: string | null): number => {
    switch (recommendation) {
      case "Strong Fit": return 1;
      case "Good Fit": return 2;
      case "Potential Fit": return 3;
      case "Not a Fit": return 4;
      default: return 5;
    }
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchData();
    }
  }, [resolvedParams.id, isAuthenticated, token]);

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();

      // Fetch job
      const jobResponse = await fetch(`${API_URL}/api/jobs/${resolvedParams.id}`, { headers });
      if (jobResponse.ok) {
        const jobData = await jobResponse.json();
        setJob(jobData);
      } else if (jobResponse.status === 401) {
        router.push("/login");
        return;
      }

      // Fetch candidates
      const candidatesResponse = await fetch(`${API_URL}/api/jobs/${resolvedParams.id}/candidates`, { headers });
      if (candidatesResponse.ok) {
        const candidatesData = await candidatesResponse.json();
        setCandidates(candidatesData.candidates || []);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500/10 border-green-500/30 text-green-400";
      case "in_progress":
        return "bg-blue-500/10 border-blue-500/30 text-blue-400";
      case "pending":
        return "bg-yellow-500/10 border-yellow-500/30 text-yellow-400";
      default:
        return "bg-gray-500/10 border-gray-500/30 text-gray-400";
    }
  };

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case "strong_hire":
        return "text-green-400";
      case "hire":
        return "text-blue-400";
      case "maybe":
        return "text-yellow-400";
      case "no_hire":
        return "text-red-400";
      default:
        return "text-white/40";
    }
  };

  const filteredCandidates = candidates
    .filter((c) => c.person_name.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((c) => statusFilter === "all" || c.interview_status === statusFilter)
    .sort((a, b) => {
      if (sortBy === "score") {
        // Sort by score (highest first)
        const scoreA = a.combined_score ?? a.ranking_score ?? 0;
        const scoreB = b.combined_score ?? b.ranking_score ?? 0;
        return scoreB - scoreA;
      }
      if (sortBy === "fit") {
        // Sort by fit category (Strong Fit first), then by score within each category
        const fitRankA = getFitRank(getRecommendation(a));
        const fitRankB = getFitRank(getRecommendation(b));
        if (fitRankA !== fitRankB) {
          return fitRankA - fitRankB;
        }
        // Same fit category - sort by score
        const scoreA = a.combined_score ?? a.ranking_score ?? 0;
        const scoreB = b.combined_score ?? b.ranking_score ?? 0;
        return scoreB - scoreA;
      }
      if (sortBy === "name") {
        return a.person_name.localeCompare(b.person_name);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  // Stats
  const completedCount = candidates.filter((c) => c.interview_status === "completed").length;
  const pendingCount = candidates.filter((c) => c.interview_status === "pending").length;
  const scoredCandidates = candidates.filter((c) => c.combined_score != null);
  const avgScore = scoredCandidates.length > 0
    ? scoredCandidates.reduce((acc, c) => acc + (c.combined_score || 0), 0) / scoredCandidates.length
    : 0;

  // Fit category counts
  const strongFitCount = candidates.filter((c) => getRecommendation(c) === "Strong Fit").length;
  const goodFitCount = candidates.filter((c) => getRecommendation(c) === "Good Fit").length;
  const potentialFitCount = candidates.filter((c) => getRecommendation(c) === "Potential Fit").length;
  const notFitCount = candidates.filter((c) => getRecommendation(c) === "Not a Fit").length;

  // Show loading while checking auth
  if (authLoading) {
    return (
      <main className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </main>
    );
  }

  // Don't render for unauthenticated users
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen gradient-bg text-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </main>
    );
  }

  if (!job) {
    return (
      <main className="min-h-screen gradient-bg text-white flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-medium text-white mb-2">Job Not Found</h2>
          <Link href="/jobs" className="text-indigo-400 hover:text-indigo-300">
            Back to Jobs
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen gradient-bg text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#000000]/80 backdrop-blur-md border-b border-white/5 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-4">
            <Link
              href={`/jobs/${resolvedParams.id}`}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white/60" />
            </Link>
            <div>
              <h1 className="text-lg font-light tracking-wide text-white">Candidates</h1>
              <p className="text-xs text-white/50">{job.title}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="pt-28 px-6 pb-12 max-w-7xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <div className="text-2xl font-light text-white">{candidates.length}</div>
                <div className="text-xs text-white/50 uppercase tracking-wider">Total</div>
              </div>
            </div>
          </div>
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <Star className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <div className="text-2xl font-light text-white">{strongFitCount}</div>
                <div className="text-xs text-white/50 uppercase tracking-wider">Strong Fit</div>
              </div>
            </div>
          </div>
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-light text-white">{goodFitCount}</div>
                <div className="text-xs text-white/50 uppercase tracking-wider">Good Fit</div>
              </div>
            </div>
          </div>
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <div className="text-2xl font-light text-white">{potentialFitCount}</div>
                <div className="text-xs text-white/50 uppercase tracking-wider">Potential</div>
              </div>
            </div>
          </div>
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <div className="text-2xl font-light text-white">{notFitCount}</div>
                <div className="text-xs text-white/50 uppercase tracking-wider">Not a Fit</div>
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
                  {avgScore > 0 ? avgScore.toFixed(0) : "—"}
                </div>
                <div className="text-xs text-white/50 uppercase tracking-wider">Avg Score</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Search candidates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          <div className="flex items-center gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
            {["all", "pending", "in_progress", "completed"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                  statusFilter === status
                    ? "bg-white text-black"
                    : "text-white/50 hover:text-white"
                }`}
              >
                {status === "all" ? "All" : status.replace("_", " ")}
              </button>
            ))}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500/50"
          >
            <option value="score">Sort by Score</option>
            <option value="fit">Sort by Fit</option>
            <option value="name">Sort by Name</option>
            <option value="date">Sort by Date</option>
          </select>
        </div>

        {/* Candidates List */}
        {filteredCandidates.length === 0 ? (
          <div className="glass-panel rounded-3xl p-12 text-center">
            <Users className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No Candidates Found</h3>
            <p className="text-white/50 mb-6">
              {searchQuery
                ? "No candidates match your search."
                : "Upload candidates to get started."}
            </p>
            <Link
              href={`/jobs/${resolvedParams.id}/upload`}
              className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-full font-medium transition-colors"
            >
              <Users className="w-4 h-4" />
              Upload Candidates
            </Link>
          </div>
        ) : (
          <div className="glass-panel rounded-2xl overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 p-4 border-b border-white/10 text-xs text-white/50 uppercase tracking-wider">
              <div className="col-span-3">Candidate</div>
              <div className="col-span-2">Fit</div>
              <div className="col-span-2 text-center">Score</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Pipeline</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-white/5">
              {filteredCandidates.map((candidate, index) => {
                const recommendation = getRecommendation(candidate);
                const score = candidate.combined_score ?? candidate.ranking_score;
                return (
                  <div
                    key={candidate.id}
                    className="grid grid-cols-12 gap-4 p-4 hover:bg-white/5 transition-colors cursor-pointer items-center"
                    onClick={() => router.push(`/jobs/${resolvedParams.id}/candidates/${candidate.id}`)}
                  >
                    {/* Candidate Info */}
                    <div className="col-span-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/60 font-medium">
                        {candidate.person_name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <div className="font-medium text-white flex items-center gap-2">
                          {candidate.person_name || "Unknown"}
                          {recommendation === "Strong Fit" && (
                            <Star className="w-4 h-4 text-green-400 fill-green-400" />
                          )}
                        </div>
                        <div className="text-xs text-white/40">
                          {candidate.current_title || candidate.person_email || candidate.email || "No email"}
                        </div>
                      </div>
                    </div>

                    {/* Fit */}
                    <div className="col-span-2">
                      {recommendation ? (
                        <span
                          className={`text-[10px] px-2 py-1 rounded-full uppercase tracking-wider border ${getFitBadgeStyle(recommendation)}`}
                        >
                          {recommendation}
                        </span>
                      ) : (
                        <span className="text-white/30 text-sm">—</span>
                      )}
                    </div>

                    {/* Score */}
                    <div className="col-span-2 text-center">
                      {score != null ? (
                        <div className="inline-flex items-center gap-2">
                          <span className="text-lg font-light text-white">
                            {score}
                          </span>
                          {score >= 75 ? (
                            <TrendingUp className="w-4 h-4 text-green-400" />
                          ) : score <= 40 ? (
                            <TrendingDown className="w-4 h-4 text-red-400" />
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-white/30">—</span>
                      )}
                    </div>

                    {/* Interview Status */}
                    <div className="col-span-2">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider border ${getStatusColor(
                          candidate.interview_status
                        )}`}
                      >
                        {(candidate.interview_status || "pending").replace("_", " ")}
                      </span>
                    </div>

                    {/* Pipeline Status */}
                    <div className="col-span-2">
                      <span className="text-sm text-white/60 capitalize">
                        {(candidate.pipeline_status || "new").replace("_", " ")}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="col-span-1 flex items-center justify-end gap-2">
                      <ChevronRight className="w-5 h-5 text-white/30" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
