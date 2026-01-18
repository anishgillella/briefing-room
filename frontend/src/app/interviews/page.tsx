"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import {
  useScheduledInterviews,
  useInterviewers,
  useJobs,
  useCancelInterview,
} from "@/hooks/useApi";
import { formatDateTime } from "@/lib/schedulingApi";
import {
  Calendar,
  Clock,
  Search,
  Filter,
  Briefcase,
  ChevronRight,
  X,
  Play,
  XCircle,
  CheckCircle,
  RefreshCw,
  Video,
  UserCheck,
  Loader2,
} from "lucide-react";
import StartInterviewModal from "@/components/StartInterviewModal";

interface Interviewer {
  id: string;
  name: string;
  email: string;
}

interface Job {
  id: string;
  title: string;
}

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  scheduled: {
    bg: "bg-blue-500/20",
    text: "text-blue-400",
    border: "border-blue-500/30",
  },
  in_progress: {
    bg: "bg-yellow-500/20",
    text: "text-yellow-400",
    border: "border-yellow-500/30",
  },
  completed: {
    bg: "bg-green-500/20",
    text: "text-green-400",
    border: "border-green-500/30",
  },
  cancelled: {
    bg: "bg-red-500/20",
    text: "text-red-400",
    border: "border-red-500/30",
  },
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  scheduled: <Clock className="w-3 h-3" />,
  in_progress: <Play className="w-3 h-3" />,
  completed: <CheckCircle className="w-3 h-3" />,
  cancelled: <XCircle className="w-3 h-3" />,
};

export default function InterviewsPage() {
  const router = useRouter();
  const { recruiter } = useAuth();

  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedInterviewer, setSelectedInterviewer] = useState("");
  const [selectedJob, setSelectedJob] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Modals
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Start interview modal
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [selectedInterviewForStart, setSelectedInterviewForStart] = useState<{
    candidateId: string;
    candidateName: string;
    jobTitle: string;
  } | null>(null);

  // React Query hooks - automatic deduplication & caching
  const {
    data: interviews = [],
    isLoading,
    refetch,
  } = useScheduledInterviews({
    interviewerId: selectedInterviewer || undefined,
    jobId: selectedJob || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    status: selectedStatus || undefined,
  });

  const { data: interviewers = [] } = useInterviewers();
  const { data: jobs = [] } = useJobs(recruiter?.id);

  const cancelInterviewMutation = useCancelInterview();

  const handleCancelInterview = async () => {
    if (!cancellingId) return;
    try {
      await cancelInterviewMutation.mutateAsync({
        interviewId: cancellingId,
        reason: cancelReason || undefined,
      });
      setCancelModalOpen(false);
      setCancellingId(null);
      setCancelReason("");
    } catch (error) {
      console.error("Failed to cancel interview:", error);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedStatus("");
    setSelectedInterviewer("");
    setSelectedJob("");
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters =
    selectedStatus || selectedInterviewer || selectedJob || dateFrom || dateTo;

  const activeFilterCount =
    (selectedStatus ? 1 : 0) +
    (selectedInterviewer ? 1 : 0) +
    (selectedJob ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  // Filter interviews by search query (client-side)
  const filteredInterviews = interviews.filter((interview: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      interview.candidate_name?.toLowerCase().includes(query) ||
      interview.interviewer_name?.toLowerCase().includes(query) ||
      interview.job_title?.toLowerCase().includes(query) ||
      interview.stage?.toLowerCase().includes(query)
    );
  });

  const getStatusStyle = (status: string) => {
    return STATUS_COLORS[status] || STATUS_COLORS.scheduled;
  };

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-7xl mx-auto">
        {/* Page Title */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-light tracking-wide">Interviews</h2>
            <p className="text-white/50 text-sm mt-1">
              {filteredInterviews.length} interview
              {filteredInterviews.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          {/* Search Bar */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="Search by candidate, interviewer, or job..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-white/30 placeholder:text-white/30"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-colors ${
                showFilters || hasActiveFilters
                  ? "bg-white/10 border-white/30 text-white"
                  : "bg-white/5 border-white/10 text-white/60 hover:border-white/20"
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {hasActiveFilters && (
                <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:border-white/20 hover:text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="glass-panel rounded-2xl p-6 space-y-6">
              {/* Active Filters */}
              {hasActiveFilters && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-white/50">Active filters:</span>
                  {selectedStatus && (
                    <button
                      onClick={() => setSelectedStatus("")}
                      className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded-lg text-xs text-blue-400"
                    >
                      {
                        STATUS_OPTIONS.find((s) => s.value === selectedStatus)
                          ?.label
                      }
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  {selectedInterviewer && (
                    <button
                      onClick={() => setSelectedInterviewer("")}
                      className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded-lg text-xs text-purple-400"
                    >
                      <UserCheck className="w-3 h-3" />
                      {(interviewers as Interviewer[]).find(
                        (i) => i.id === selectedInterviewer
                      )?.name || "Interviewer"}
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  {selectedJob && (
                    <button
                      onClick={() => setSelectedJob("")}
                      className="flex items-center gap-1 px-2 py-1 bg-orange-500/20 border border-orange-500/30 rounded-lg text-xs text-orange-400"
                    >
                      <Briefcase className="w-3 h-3" />
                      {(jobs as Job[]).find((j) => j.id === selectedJob)
                        ?.title || "Job"}
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  {dateFrom && (
                    <button
                      onClick={() => setDateFrom("")}
                      className="flex items-center gap-1 px-2 py-1 bg-green-500/20 border border-green-500/30 rounded-lg text-xs text-green-400"
                    >
                      <Calendar className="w-3 h-3" />
                      From: {dateFrom}
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  {dateTo && (
                    <button
                      onClick={() => setDateTo("")}
                      className="flex items-center gap-1 px-2 py-1 bg-green-500/20 border border-green-500/30 rounded-lg text-xs text-green-400"
                    >
                      <Calendar className="w-3 h-3" />
                      To: {dateTo}
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={clearFilters}
                    className="text-xs text-white/40 hover:text-white/60 underline ml-2"
                  >
                    Clear all
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Status Filter */}
                <div>
                  <label className="text-sm text-white/60 mb-2 block">
                    Status
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/30"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Interviewer Filter */}
                <div>
                  <label className="text-sm text-white/60 mb-2 block">
                    Interviewer
                  </label>
                  <select
                    value={selectedInterviewer}
                    onChange={(e) => setSelectedInterviewer(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/30"
                  >
                    <option value="">All Interviewers</option>
                    {(interviewers as Interviewer[]).map((interviewer) => (
                      <option key={interviewer.id} value={interviewer.id}>
                        {interviewer.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Job Filter */}
                <div>
                  <label className="text-sm text-white/60 mb-2 block">
                    Job Position
                  </label>
                  <select
                    value={selectedJob}
                    onChange={(e) => setSelectedJob(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/30"
                  >
                    <option value="">All Jobs</option>
                    {(jobs as Job[]).map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date From */}
                <div>
                  <label className="text-sm text-white/60 mb-2 block">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/30"
                  />
                </div>

                {/* Date To */}
                <div>
                  <label className="text-sm text-white/60 mb-2 block">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          </div>
        ) : filteredInterviews.length === 0 ? (
          <div className="glass-panel rounded-3xl p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-6">
              <Calendar className="w-8 h-8 text-white/20" />
            </div>
            <h3 className="text-xl font-light mb-2">No interviews found</h3>
            <p className="text-white/50 text-sm">
              {hasActiveFilters
                ? "Try adjusting your filters"
                : "Schedule interviews with candidates to see them here"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredInterviews.map((interview: any) => {
              const statusStyle = getStatusStyle(interview.status);
              // Show Start button for scheduled or active/in_progress interviews
              const canStart =
                (interview.status === "scheduled" || interview.status === "active" || interview.status === "in_progress") &&
                interview.candidate_id;
              const isUpcoming =
                interview.status === "scheduled" && interview.scheduled_at;
              const scheduledDate = interview.scheduled_at
                ? new Date(interview.scheduled_at)
                : null;

              return (
                <div
                  key={interview.id}
                  className="glass-panel rounded-2xl p-5 hover:bg-white/[0.08] transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Interview Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        {/* Status Badge */}
                        <span
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs ${statusStyle.bg} ${statusStyle.text} border ${statusStyle.border}`}
                        >
                          {STATUS_ICONS[interview.status]}
                          {interview.status.replace("_", " ")}
                        </span>
                        {/* Stage Badge */}
                        <span className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-white/60">
                          {interview.stage?.replace("_", " ") || "Interview"}
                        </span>
                      </div>

                      {/* Candidate Name */}
                      <h3 className="font-medium text-white text-lg mb-1">
                        {interview.candidate_name || "Unknown Candidate"}
                      </h3>

                      {/* Meta Info */}
                      <div className="flex items-center gap-4 text-sm text-white/50">
                        {interview.job_title && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="w-3.5 h-3.5" />
                            {interview.job_title}
                          </span>
                        )}
                        {interview.interviewer_name && (
                          <span className="flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5" />
                            {interview.interviewer_name}
                          </span>
                        )}
                        {interview.duration_minutes && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {interview.duration_minutes} min
                          </span>
                        )}
                      </div>

                      {/* Scheduled Time */}
                      {scheduledDate && (
                        <div className="flex items-center gap-2 mt-3 text-sm">
                          <Calendar className="w-4 h-4 text-white/40" />
                          <span className="text-white/70">
                            {formatDateTime(
                              interview.scheduled_at!,
                              interview.timezone
                            )}
                          </span>
                        </div>
                      )}

                      {/* Notes */}
                      {interview.notes && (
                        <p className="text-sm text-white/40 mt-2 line-clamp-1">
                          {interview.notes}
                        </p>
                      )}

                      {/* Cancel Reason */}
                      {interview.cancel_reason && (
                        <p className="text-sm text-red-400/70 mt-2">
                          Cancelled: {interview.cancel_reason}
                        </p>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Start button for scheduled, active, or in_progress interviews */}
                      {canStart && (
                        <button
                          onClick={() => {
                            setSelectedInterviewForStart({
                              candidateId: interview.candidate_id,
                              candidateName: interview.candidate_name || "Unknown Candidate",
                              jobTitle: interview.job_title || "",
                            });
                            setStartModalOpen(true);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-sm text-indigo-400 hover:bg-indigo-500/30 transition-colors"
                        >
                          <Video className="w-4 h-4" />
                          {interview.status === "scheduled" ? "Start" : "Join"}
                        </button>
                      )}
                      {/* Cancel button only for scheduled interviews */}
                      {isUpcoming && (
                        <button
                          onClick={() => {
                            setCancellingId(interview.id);
                            setCancelModalOpen(true);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                          Cancel
                        </button>
                      )}
                      {interview.status === "completed" && (
                        <Link
                          href={`/candidates/${interview.candidate_id}`}
                          className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white/60 hover:bg-white/10 transition-colors"
                        >
                          View Details
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cancel Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-panel rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-white mb-4">
              Cancel Interview
            </h3>
            <p className="text-white/60 text-sm mb-4">
              Are you sure you want to cancel this interview? This action cannot
              be undone.
            </p>
            <div className="mb-4">
              <label className="text-sm text-white/60 mb-2 block">
                Reason (optional)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Enter cancellation reason..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 placeholder:text-white/30 resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setCancelModalOpen(false);
                  setCancellingId(null);
                  setCancelReason("");
                }}
                className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white/60 hover:bg-white/10 transition-colors"
              >
                Keep Interview
              </button>
              <button
                onClick={handleCancelInterview}
                disabled={cancelInterviewMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-xl text-sm text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
              >
                {cancelInterviewMutation.isPending
                  ? "Cancelling..."
                  : "Cancel Interview"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Start Interview Modal - Role Selection */}
      <StartInterviewModal
        isOpen={startModalOpen}
        onClose={() => {
          setStartModalOpen(false);
          setSelectedInterviewForStart(null);
        }}
        candidateId={selectedInterviewForStart?.candidateId || ""}
        candidateName={selectedInterviewForStart?.candidateName || ""}
        jobTitle={selectedInterviewForStart?.jobTitle || ""}
      />
    </AppLayout>
  );
}
