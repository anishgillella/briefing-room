"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { useJobs, useDeleteJob } from "@/hooks/useApi";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Briefcase,
  Users,
  CheckCircle,
  Clock,
  ChevronRight,
  Play,
  Trash2,
  Mic,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { SkeletonCard } from "@/components/ui/skeleton";
import { FadeInUp, Stagger, StaggerItem } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

export default function JobsPage() {
  const router = useRouter();
  const { recruiter } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: jobs = [],
    isLoading,
    error,
  } = useJobs(recruiter?.id, statusFilter !== "all" ? statusFilter : undefined);

  const deleteJobMutation = useDeleteJob();

  const handleDeleteJob = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

  const filterTabs = [
    { id: "all", label: "All" },
    { id: "active", label: "Active" },
    { id: "draft", label: "Draft" },
    { id: "paused", label: "Paused" },
    { id: "closed", label: "Closed" },
  ];

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-7xl mx-auto">
        {/* Page Header */}
        <FadeInUp>
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
                Jobs
              </h1>
              <p className="text-zinc-400">
                Manage your job postings and track candidates
              </p>
            </div>
            <Button
              onClick={() => router.push("/jobs/new")}
              leftIcon={<Plus className="w-4 h-4" />}
              size="lg"
            >
              Create Job
            </Button>
          </div>
        </FadeInUp>

        {/* Stats Cards */}
        <FadeInUp delay={0.1}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <motion.div
              whileHover={{ y: -2 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <Card padding="md" className="h-full">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-indigo-500/10">
                    <Briefcase className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-3xl font-light text-white tracking-tight">
                      {jobs.length}
                    </p>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mt-0.5">
                      Total Jobs
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div
              whileHover={{ y: -2 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <Card padding="md" className="h-full">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-emerald-500/10">
                    <Play className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-3xl font-light text-white tracking-tight">
                      {activeJobs}
                    </p>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mt-0.5">
                      Active
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div
              whileHover={{ y: -2 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <Card padding="md" className="h-full">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-purple-500/10">
                    <Users className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-3xl font-light text-white tracking-tight">
                      {totalCandidates}
                    </p>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mt-0.5">
                      Candidates
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div
              whileHover={{ y: -2 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <Card padding="md" className="h-full">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-cyan-500/10">
                    <CheckCircle className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-3xl font-light text-white tracking-tight">
                      {totalInterviewed}
                    </p>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mt-0.5">
                      Interviewed
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </FadeInUp>

        {/* Filters */}
        <FadeInUp delay={0.15}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
            <SearchInput
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery("")}
              className="w-full sm:max-w-xs"
            />

            <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
              {filterTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={cn(
                    "relative px-4 py-2 rounded-lg text-sm font-medium transition-all",
                    statusFilter === tab.id
                      ? "text-white"
                      : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  {statusFilter === tab.id && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-zinc-800 rounded-lg"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 capitalize">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </FadeInUp>

        {/* Jobs List */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {[1, 2, 3].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <Card padding="lg" className="text-center">
                <div className="p-4 rounded-full bg-red-500/10 w-fit mx-auto mb-4">
                  <X className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">
                  Failed to load jobs
                </h3>
                <p className="text-zinc-400 mb-4">
                  There was an error loading your jobs. Please try again.
                </p>
                <Button variant="secondary" onClick={() => window.location.reload()}>
                  Retry
                </Button>
              </Card>
            </motion.div>
          ) : filteredJobs.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <Card padding="lg" className="text-center py-16">
                <motion.div
                  className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-6 border border-white/10"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Briefcase className="w-10 h-10 text-indigo-400" />
                </motion.div>

                <h3 className="text-2xl font-bold text-white mb-3">
                  {searchQuery ? "No jobs found" : "Create your first job"}
                </h3>
                <p className="text-zinc-400 mb-8 max-w-md mx-auto">
                  {searchQuery
                    ? "No jobs match your search. Try a different keyword."
                    : "Get started by creating a job posting. Paste your job description and we'll extract the requirements automatically."}
                </p>

                {!searchQuery && (
                  <>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                      <Button
                        onClick={() => router.push("/jobs/new")}
                        leftIcon={<Plus className="w-4 h-4" />}
                        size="lg"
                      >
                        Create Job from JD
                      </Button>
                      <span className="text-zinc-600">or</span>
                      <Button
                        variant="glass"
                        onClick={() => router.push("/jobs/new?voice=true")}
                        leftIcon={<Mic className="w-4 h-4 text-indigo-400" />}
                        rightIcon={<Sparkles className="w-3 h-3 text-purple-400" />}
                        size="lg"
                      >
                        Voice Setup
                      </Button>
                    </div>

                    <div className="mt-12 pt-8 border-t border-zinc-800/50">
                      <p className="text-xs text-zinc-600 uppercase tracking-wider mb-6">
                        How it works
                      </p>
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                        {[
                          { step: 1, text: "Paste job description", color: "indigo" },
                          { step: 2, text: "Upload candidates", color: "purple" },
                          { step: 3, text: "Run AI interviews", color: "cyan" },
                        ].map((item, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <div
                              className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                                item.color === "indigo" && "bg-indigo-500/20 text-indigo-400",
                                item.color === "purple" && "bg-purple-500/20 text-purple-400",
                                item.color === "cyan" && "bg-cyan-500/20 text-cyan-400"
                              )}
                            >
                              {item.step}
                            </div>
                            <span className="text-sm text-zinc-400">{item.text}</span>
                            {i < 2 && (
                              <ChevronRight className="w-4 h-4 text-zinc-700 hidden sm:block" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </Card>
            </motion.div>
          ) : (
            <Stagger key="jobs-list" className="space-y-3">
              {filteredJobs.map((job) => (
                <StaggerItem key={job.id}>
                  <motion.div
                    whileHover={{ scale: 1.005, y: -2 }}
                    whileTap={{ scale: 0.995 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    <Card
                      variant="interactive"
                      padding="none"
                      className="group cursor-pointer"
                      onClick={() => router.push(`/jobs/${job.id}`)}
                    >
                      <div className="flex items-center p-5">
                        {/* Job Icon */}
                        <div className="hidden sm:flex mr-4">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center border border-white/5">
                            <Briefcase className="w-5 h-5 text-indigo-400" />
                          </div>
                        </div>

                        {/* Job Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-medium text-white group-hover:text-indigo-300 transition-colors truncate">
                              {job.title}
                            </h3>
                            <StatusBadge
                              status={job.status as "active" | "draft" | "paused" | "closed"}
                              size="sm"
                            />
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500">
                            <span className="flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5" />
                              {job.candidate_count} candidates
                            </span>
                            <span className="flex items-center gap-1.5">
                              <CheckCircle className="w-3.5 h-3.5" />
                              {job.interviewed_count} interviewed
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" />
                              {new Date(job.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => handleDeleteJob(job.id, e)}
                            disabled={deleteJobMutation.isPending}
                            className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                        </div>
                      </div>

                      {/* Progress bar for candidates */}
                      {job.candidate_count > 0 && (
                        <div className="px-5 pb-4">
                          <div className="h-1 bg-zinc-800/50 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                              initial={{ width: 0 }}
                              animate={{
                                width: `${Math.min(
                                  (job.interviewed_count / job.candidate_count) * 100,
                                  100
                                )}%`,
                              }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                            />
                          </div>
                        </div>
                      )}
                    </Card>
                  </motion.div>
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
