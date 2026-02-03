"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { tokens, springConfig, easeOutCustom } from "@/lib/design-tokens";
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
  X,
  ArrowRightCircle,
  XCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Job {
  id: string;
  title: string;
  status: string;
}

interface Candidate {
  id: string;
  person_id: string;
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

type BulkAction = "move_stage" | "reject" | "accept";

const PIPELINE_STAGES = [
  { value: "new", label: "New" },
  { value: "round_1", label: "Round 1" },
  { value: "round_2", label: "Round 2" },
  { value: "round_3", label: "Round 3" },
  { value: "decision_pending", label: "Decision Pending" },
];

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

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [showStageDropdown, setShowStageDropdown] = useState(false);

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

  // Bulk selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCandidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCandidates.map((c) => c.id)));
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setShowStageDropdown(false);
  };

  // Bulk action handler
  const executeBulkAction = async (action: BulkAction, targetStage?: string) => {
    if (selectedIds.size === 0) return;

    setBulkActionLoading(true);
    setShowStageDropdown(false);

    try {
      const headers = {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      };

      const body: Record<string, unknown> = {
        candidate_ids: Array.from(selectedIds),
        action,
      };

      if (action === "move_stage" && targetStage) {
        body.target_stage = targetStage;
      }

      const response = await fetch(
        `${API_URL}/api/jobs/${resolvedParams.id}/candidates/bulk-update`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log("Bulk update result:", result);
        // Refresh data and clear selection
        await fetchData();
        setSelectedIds(new Set());
      } else {
        const error = await response.json();
        console.error("Bulk update failed:", error);
        alert(`Failed to update candidates: ${error.detail || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Bulk action error:", error);
      alert("An error occurred while updating candidates");
    } finally {
      setBulkActionLoading(false);
    }
  };

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

  const isAllSelected = filteredCandidates.length > 0 && selectedIds.size === filteredCandidates.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < filteredCandidates.length;

  // Show loading while checking auth
  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!job) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-white mb-2">Job Not Found</h2>
            <Link href="/jobs" className="text-indigo-400 hover:text-indigo-300">
              Back to Jobs
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-7xl mx-auto">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: easeOutCustom }}
          className="flex items-center gap-4 mb-8"
        >
          <Link
            href={`/jobs/${resolvedParams.id}`}
            className="p-2 rounded-xl transition-all duration-200"
            style={{
              backgroundColor: tokens.bgSurface,
              border: `1px solid ${tokens.borderSubtle}`,
            }}
          >
            <ArrowLeft className="w-5 h-5" style={{ color: tokens.textMuted }} />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: tokens.textPrimary }}>Candidates</h1>
            <p className="text-sm" style={{ color: tokens.textMuted }}>{job.title}</p>
          </div>
        </motion.div>

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 bg-indigo-600 rounded-2xl shadow-2xl shadow-indigo-500/20 px-6 py-3 flex items-center gap-4 animate-in slide-in-from-top-2 duration-200">
            <span className="text-sm font-medium text-white">
              {selectedIds.size} selected
            </span>
            <div className="h-5 w-px bg-white/20" />

            {/* Move to Stage */}
            <div className="relative">
              <button
                onClick={() => setShowStageDropdown(!showStageDropdown)}
                disabled={bulkActionLoading}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <ArrowRightCircle className="w-4 h-4" />
                Move to Stage
              </button>
              {showStageDropdown && (
                <div className="absolute top-full left-0 mt-2 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-xl py-2 min-w-[160px]">
                  {PIPELINE_STAGES.map((stage) => (
                    <button
                      key={stage.value}
                      onClick={() => executeBulkAction("move_stage", stage.value)}
                      className="w-full px-4 py-2 text-left text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      {stage.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Accept */}
            <button
              onClick={() => executeBulkAction("accept")}
              disabled={bulkActionLoading}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              Accept
            </button>

            {/* Reject */}
            <button
              onClick={() => executeBulkAction("reject")}
              disabled={bulkActionLoading}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              Reject
            </button>

            <div className="h-5 w-px bg-white/20" />

            {/* Clear Selection */}
            <button
              onClick={clearSelection}
              disabled={bulkActionLoading}
              className="flex items-center gap-1 px-2 py-1.5 hover:bg-white/10 rounded-lg text-sm text-white/70 hover:text-white transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>

            {bulkActionLoading && (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            )}
          </div>
        )}

        <div className="pt-28 px-6 pb-12 max-w-7xl mx-auto">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
            {[
              { icon: Users, value: candidates.length, label: "Total", color: "#A855F7" },
              { icon: Star, value: strongFitCount, label: "Strong Fit", color: tokens.statusSuccess },
              { icon: CheckCircle, value: goodFitCount, label: "Good Fit", color: "#3B82F6" },
              { icon: Clock, value: potentialFitCount, label: "Potential", color: tokens.statusWarning },
              { icon: AlertCircle, value: notFitCount, label: "Not a Fit", color: tokens.statusDanger },
              { icon: TrendingUp, value: avgScore > 0 ? avgScore.toFixed(0) : "—", label: "Avg Score", color: "#06B6D4" },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.05, ease: easeOutCustom }}
                className="rounded-2xl p-5"
                style={{
                  backgroundColor: tokens.bgSurface,
                  border: `1px solid ${tokens.borderDefault}`,
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${stat.color}15` }}
                  >
                    <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                  </div>
                  <div>
                    <div className="text-2xl font-light" style={{ color: tokens.textPrimary }}>{stat.value}</div>
                    <div className="text-xs uppercase tracking-wider" style={{ color: tokens.textMuted }}>{stat.label}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3, ease: easeOutCustom }}
            className="flex items-center gap-4 mb-6"
          >
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: tokens.textMuted }} />
              <input
                type="text"
                placeholder="Search candidates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none"
                style={{
                  backgroundColor: tokens.bgSurface,
                  border: `1px solid ${tokens.borderDefault}`,
                  color: tokens.textPrimary,
                }}
              />
            </div>

            <div
              className="flex items-center gap-1 p-1 rounded-xl"
              style={{
                backgroundColor: tokens.bgSurface,
                border: `1px solid ${tokens.borderDefault}`,
              }}
            >
              {["all", "pending", "in_progress", "completed"].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize"
                  style={{
                    backgroundColor: statusFilter === status ? tokens.brandPrimary : "transparent",
                    color: statusFilter === status ? "#fff" : tokens.textMuted,
                  }}
                >
                  {status === "all" ? "All" : status.replace("_", " ")}
                </button>
              ))}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2.5 rounded-xl text-sm focus:outline-none"
              style={{
                backgroundColor: tokens.bgSurface,
                border: `1px solid ${tokens.borderDefault}`,
                color: tokens.textPrimary,
              }}
            >
              <option value="score">Sort by Score</option>
              <option value="fit">Sort by Fit</option>
              <option value="name">Sort by Name</option>
              <option value="date">Sort by Date</option>
            </select>
          </motion.div>

          {/* Candidates List */}
          {filteredCandidates.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.35, ease: easeOutCustom }}
              className="rounded-3xl p-12 text-center"
              style={{
                backgroundColor: tokens.bgSurface,
                border: `1px solid ${tokens.borderDefault}`,
              }}
            >
              <Users className="w-12 h-12 mx-auto mb-4" style={{ color: tokens.textDisabled }} />
              <h3 className="text-lg font-medium mb-2" style={{ color: tokens.textPrimary }}>No Candidates Found</h3>
              <p className="mb-6" style={{ color: tokens.textMuted }}>
                {searchQuery
                  ? "No candidates match your search."
                  : "Upload candidates to get started."}
              </p>
              <Link
                href={`/jobs/${resolvedParams.id}/upload`}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full font-medium transition-colors text-white"
                style={{ background: tokens.gradientPrimary }}
              >
                <Users className="w-4 h-4" />
                Upload Candidates
              </Link>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.35, ease: easeOutCustom }}
              className="rounded-2xl overflow-hidden"
              style={{
                backgroundColor: tokens.bgSurface,
                border: `1px solid ${tokens.borderDefault}`,
              }}
            >
              {/* Table Header */}
              <div
                className="grid grid-cols-12 gap-4 p-4 text-xs uppercase tracking-wider"
                style={{ borderBottom: `1px solid ${tokens.borderDefault}`, color: tokens.textMuted }}
              >
                <div className="col-span-1 flex items-center">
                  <button
                    onClick={toggleSelectAll}
                    className="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
                    style={{
                      backgroundColor: isAllSelected ? tokens.brandPrimary : isSomeSelected ? `${tokens.brandPrimary}50` : "transparent",
                      borderColor: isAllSelected || isSomeSelected ? tokens.brandPrimary : tokens.borderDefault,
                    }}
                  >
                    {(isAllSelected || isSomeSelected) && (
                      <CheckCircle2 className="w-3 h-3 text-white" />
                    )}
                  </button>
                </div>
                <div className="col-span-3">Candidate</div>
                <div className="col-span-2">Fit</div>
                <div className="col-span-1 text-center">Score</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Pipeline</div>
                <div className="col-span-1 text-right">Actions</div>
              </div>

              {/* Table Body */}
              <div>
                {filteredCandidates.map((candidate, index) => {
                  const recommendation = getRecommendation(candidate);
                  const score = candidate.combined_score ?? candidate.ranking_score;
                  const isSelected = selectedIds.has(candidate.id);
                  return (
                    <div
                      key={candidate.id}
                      className="grid grid-cols-12 gap-4 p-4 transition-colors cursor-pointer items-center"
                      style={{
                        backgroundColor: isSelected ? `${tokens.brandPrimary}10` : "transparent",
                        borderBottom: `1px solid ${tokens.borderSubtle}`,
                      }}
                      onClick={() => router.push(`/talent-pool/${candidate.person_id}`)}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = tokens.bgSurfaceHover;
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      {/* Checkbox */}
                      <div className="col-span-1 flex items-center">
                        <button
                          onClick={(e) => toggleSelect(candidate.id, e)}
                          className="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
                          style={{
                            backgroundColor: isSelected ? tokens.brandPrimary : "transparent",
                            borderColor: isSelected ? tokens.brandPrimary : tokens.borderDefault,
                          }}
                        >
                          {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </button>
                      </div>

                      {/* Candidate Info */}
                      <div className="col-span-4 flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center font-medium"
                          style={{ backgroundColor: tokens.bgCard, color: tokens.textMuted }}
                        >
                          {candidate.person_name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <div>
                          <div className="font-medium text-sm" style={{ color: tokens.textPrimary }}>
                            {candidate.person_name || "Unknown"}
                          </div>
                          <div className="text-xs font-mono text-red-500">
                            PID: {candidate.person_id}
                          </div>
                          <div className="text-xs" style={{ color: tokens.textMuted }}>
                            {candidate.current_title}
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
                          <span style={{ color: tokens.textDisabled }}>—</span>
                        )}
                      </div>

                      {/* Score */}
                      <div className="col-span-1 text-center">
                        {score != null ? (
                          <div className="inline-flex items-center gap-1">
                            <span className="text-lg font-light" style={{ color: tokens.textPrimary }}>
                              {score}
                            </span>
                            {score >= 75 ? (
                              <TrendingUp className="w-3 h-3" style={{ color: tokens.statusSuccess }} />
                            ) : score <= 40 ? (
                              <TrendingDown className="w-3 h-3" style={{ color: tokens.statusDanger }} />
                            ) : null}
                          </div>
                        ) : (
                          <span style={{ color: tokens.textDisabled }}>—</span>
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
                        <span className="text-sm capitalize" style={{ color: tokens.textSecondary }}>
                          {(candidate.pipeline_status || "new").replace("_", " ")}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="col-span-1 flex items-center justify-end gap-2">
                        <ChevronRight className="w-5 h-5" style={{ color: tokens.textDisabled }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
