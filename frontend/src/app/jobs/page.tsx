"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { useJobs, useDeleteJob } from "@/hooks/useApi";
import {
  Plus,
  Briefcase,
  Users,
  CheckCircle,
  Clock,
  ChevronRight,
  Search,
  Play,
  Trash2,
  Mic,
  Sparkles,
} from "lucide-react";

export default function JobsPage() {
  const router = useRouter();
  const { recruiter } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Use React Query for data fetching - automatic deduplication & caching
  const {
    data: jobs = [],
    isLoading,
    error,
  } = useJobs(recruiter?.id, statusFilter !== "all" ? statusFilter : undefined);

  // Use React Query mutation for deleting
  const deleteJobMutation = useDeleteJob();

  const handleDeleteJob = async (jobId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this job? This will also delete all candidates and analytics."
      )
    ) {
      return;
    }
    deleteJobMutation.mutate(jobId);
  };

  const filteredJobs = jobs.filter((job) =>
    job.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stats
  const activeJobs = jobs.filter((j) => j.status === "active").length;
  const totalCandidates = jobs.reduce((acc, j) => acc + j.candidate_count, 0);
  const totalInterviewed = jobs.reduce(
    (acc, j) => acc + j.interviewed_count,
    0
  );

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Jobs</h2>
            <p className="text-white/50">
              Manage your job postings and candidates
            </p>
          </div>
          <button
            onClick={() => router.push("/jobs/new")}
            className="flex items-center gap-2 px-5 py-3 bg-white text-black rounded-full font-medium hover:bg-gray-100 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create New Job
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <div className="text-2xl font-light text-white">
                  {jobs.length}
                </div>
                <div className="text-xs text-white/50 uppercase tracking-wider">
                  Total Jobs
                </div>
              </div>
            </div>
          </div>
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <Play className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <div className="text-2xl font-light text-white">
                  {activeJobs}
                </div>
                <div className="text-xs text-white/50 uppercase tracking-wider">
                  Active
                </div>
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
                  {totalCandidates}
                </div>
                <div className="text-xs text-white/50 uppercase tracking-wider">
                  Candidates
                </div>
              </div>
            </div>
          </div>
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <div className="text-2xl font-light text-white">
                  {totalInterviewed}
                </div>
                <div className="text-xs text-white/50 uppercase tracking-wider">
                  Interviewed
                </div>
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
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="glass-panel rounded-3xl p-12 text-center">
            <p className="text-red-400">Failed to load jobs. Please try again.</p>
          </div>
        ) : filteredJobs.length === 0 ? (
          /* Empty State for New Users */
          <div className="glass-panel rounded-3xl p-12 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-6">
              <Briefcase className="w-10 h-10 text-indigo-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">
              {searchQuery ? "No jobs found" : "Create your first job"}
            </h3>
            <p className="text-white/50 mb-8 max-w-md mx-auto">
              {searchQuery
                ? "No jobs match your search. Try a different keyword."
                : "Get started by creating a job posting. Paste your job description and we'll extract the requirements automatically."}
            </p>

            {!searchQuery && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={() => router.push("/jobs/new")}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 rounded-full font-medium transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Create Job from JD
                </button>
                <span className="text-white/30">or</span>
                <button
                  onClick={() => router.push("/jobs/new?voice=true")}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full font-medium transition-all"
                >
                  <Mic className="w-4 h-4 text-indigo-400" />
                  Voice Setup
                  <Sparkles className="w-3 h-3 text-purple-400" />
                </button>
              </div>
            )}

            {!searchQuery && (
              <div className="mt-10 pt-8 border-t border-white/10">
                <p className="text-xs text-white/30 uppercase tracking-wider mb-4">
                  How it works
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-white/50">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs text-indigo-400 font-bold">
                      1
                    </div>
                    Paste job description
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/20 hidden sm:block" />
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-xs text-purple-400 font-bold">
                      2
                    </div>
                    Upload candidates
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/20 hidden sm:block" />
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-xs text-cyan-400 font-bold">
                      3
                    </div>
                    Run AI interviews
                  </div>
                </div>
              </div>
            )}
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
                  {/* Left: Title and Info */}
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-white group-hover:text-indigo-300 transition-colors mb-2">
                      {job.title}
                    </h3>
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

                  {/* Actions - Delete only */}
                  <div
                    className="flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleDeleteJob(job.id)}
                      disabled={deleteJobMutation.isPending}
                      className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-50"
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
      </div>
    </AppLayout>
  );
}
