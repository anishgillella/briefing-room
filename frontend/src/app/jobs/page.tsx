"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRecruiter } from "@/contexts/RecruiterContext";
import RecruiterSelector from "@/components/RecruiterSelector";
import {
  Plus,
  Briefcase,
  Users,
  CheckCircle,
  Clock,
  ChevronRight,
  Search,
  Filter,
  MoreVertical,
  Play,
  Pause,
  Archive,
  Trash2,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Job {
  id: string;
  title: string;
  status: "draft" | "active" | "paused" | "closed";
  recruiter_id?: string;
  candidate_count: number;
  interviewed_count: number;
  created_at: string;
  extracted_requirements?: {
    required_skills?: string[];
    years_experience?: string;
  };
}

export default function JobsPage() {
  const router = useRouter();
  const { currentRecruiter } = useRecruiter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (currentRecruiter) {
      fetchJobs();
    } else {
      setJobs([]);
      setLoading(false);
    }
  }, [currentRecruiter, statusFilter]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      let url = `${API_URL}/api/jobs?recruiter_id=${currentRecruiter?.id}`;
      if (statusFilter !== "all") {
        url += `&status=${statusFilter}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setJobs(data);
      }
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateJobStatus = async (jobId: string, action: "activate" | "pause" | "close" | "reopen") => {
    try {
      const response = await fetch(`${API_URL}/api/jobs/${jobId}/${action}`, {
        method: "POST",
      });
      if (response.ok) {
        fetchJobs();
      }
    } catch (error) {
      console.error(`Failed to ${action} job:`, error);
    }
  };

  const deleteJob = async (jobId: string) => {
    if (!confirm("Are you sure you want to delete this job? This will also delete all candidates and analytics.")) {
      return;
    }
    try {
      const response = await fetch(`${API_URL}/api/jobs/${jobId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        fetchJobs();
      }
    } catch (error) {
      console.error("Failed to delete job:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/10 border-green-500/30 text-green-400";
      case "draft":
        return "bg-yellow-500/10 border-yellow-500/30 text-yellow-400";
      case "paused":
        return "bg-orange-500/10 border-orange-500/30 text-orange-400";
      case "closed":
        return "bg-gray-500/10 border-gray-500/30 text-gray-400";
      default:
        return "bg-gray-500/10 border-gray-500/30 text-gray-400";
    }
  };

  const filteredJobs = jobs.filter((job) =>
    job.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stats
  const activeJobs = jobs.filter((j) => j.status === "active").length;
  const totalCandidates = jobs.reduce((acc, j) => acc + j.candidate_count, 0);
  const totalInterviewed = jobs.reduce((acc, j) => acc + j.interviewed_count, 0);

  return (
    <main className="min-h-screen gradient-bg text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#000000]/80 backdrop-blur-md border-b border-white/5 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto px-6">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/10">
              <span className="text-sm">⚛️</span>
            </div>
            <h1 className="text-lg font-light tracking-wide text-white">Briefing Room</h1>
          </Link>

          <div className="flex items-center gap-4">
            <RecruiterSelector />
          </div>
        </div>
      </header>

      <div className="pt-28 px-6 pb-12 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Jobs</h2>
            <p className="text-white/50">
              {currentRecruiter
                ? `Manage job postings for ${currentRecruiter.name}`
                : "Select a recruiter to view jobs"}
            </p>
          </div>
          {currentRecruiter && (
            <button
              onClick={() => router.push("/jobs/new")}
              className="flex items-center gap-2 px-5 py-3 bg-white text-black rounded-full font-medium hover:bg-gray-100 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create New Job
            </button>
          )}
        </div>

        {!currentRecruiter ? (
          <div className="glass-panel rounded-3xl p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center mx-auto mb-6">
              <Briefcase className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">Select a Recruiter</h3>
            <p className="text-white/50 mb-6">
              Choose a recruiter from the dropdown above to view and manage their jobs.
            </p>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="glass-panel rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                    <Briefcase className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-light text-white">{jobs.length}</div>
                    <div className="text-xs text-white/50 uppercase tracking-wider">Total Jobs</div>
                  </div>
                </div>
              </div>
              <div className="glass-panel rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <Play className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-light text-white">{activeJobs}</div>
                    <div className="text-xs text-white/50 uppercase tracking-wider">Active</div>
                  </div>
                </div>
              </div>
              <div className="glass-panel rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-light text-white">{totalCandidates}</div>
                    <div className="text-xs text-white/50 uppercase tracking-wider">Candidates</div>
                  </div>
                </div>
              </div>
              <div className="glass-panel rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-light text-white">{totalInterviewed}</div>
                    <div className="text-xs text-white/50 uppercase tracking-wider">Interviewed</div>
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
                  placeholder="Search jobs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-indigo-500/50"
                />
              </div>
              <div className="flex items-center gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
                {["all", "active", "draft", "paused", "closed"].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                      statusFilter === status
                        ? "bg-white text-black"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Jobs List */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="glass-panel rounded-3xl p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-6">
                  <Briefcase className="w-8 h-8 text-white/40" />
                </div>
                <h3 className="text-xl font-medium text-white mb-2">No Jobs Found</h3>
                <p className="text-white/50 mb-6">
                  {searchQuery
                    ? "No jobs match your search."
                    : "Create your first job to get started."}
                </p>
                <button
                  onClick={() => router.push("/jobs/new")}
                  className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-full font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create New Job
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredJobs.map((job) => (
                  <div
                    key={job.id}
                    className="glass-panel rounded-2xl p-0 hover:bg-white/5 transition-all group cursor-pointer"
                    onClick={() => router.push(`/jobs/${job.id}`)}
                  >
                    <div className="flex items-center p-5">
                      {/* Left: Title and Status */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-medium text-white group-hover:text-indigo-300 transition-colors">
                            {job.title}
                          </h3>
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
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(job.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Right: Skills Preview */}
                      {job.extracted_requirements?.required_skills && (
                        <div className="hidden md:flex items-center gap-2 mr-6">
                          {job.extracted_requirements.required_skills.slice(0, 3).map((skill) => (
                            <span
                              key={skill}
                              className="px-2 py-1 bg-white/5 rounded-lg text-xs text-white/60"
                            >
                              {skill}
                            </span>
                          ))}
                          {job.extracted_requirements.required_skills.length > 3 && (
                            <span className="text-xs text-white/40">
                              +{job.extracted_requirements.required_skills.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {job.status === "draft" && (
                          <button
                            onClick={() => updateJobStatus(job.id, "activate")}
                            className="p-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-colors"
                            title="Activate"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        )}
                        {job.status === "active" && (
                          <button
                            onClick={() => updateJobStatus(job.id, "pause")}
                            className="p-2 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 transition-colors"
                            title="Pause"
                          >
                            <Pause className="w-4 h-4" />
                          </button>
                        )}
                        {job.status === "paused" && (
                          <button
                            onClick={() => updateJobStatus(job.id, "reopen")}
                            className="p-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-colors"
                            title="Reopen"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        )}
                        {(job.status === "active" || job.status === "paused") && (
                          <button
                            onClick={() => updateJobStatus(job.id, "close")}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 transition-colors"
                            title="Close"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteJob(job.id)}
                          className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white/60 transition-colors ml-2" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
