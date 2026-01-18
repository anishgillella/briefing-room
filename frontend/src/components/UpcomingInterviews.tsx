"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  User,
  Play,
  ChevronRight,
  CalendarDays,
  Loader2,
  Video,
} from "lucide-react";
import {
  getUpcomingInterviews,
  ScheduledInterview,
  formatDateTime,
} from "@/lib/schedulingApi";

interface UpcomingInterviewsProps {
  limit?: number;
  showHeader?: boolean;
  className?: string;
}

export default function UpcomingInterviews({
  limit = 5,
  showHeader = true,
  className = "",
}: UpcomingInterviewsProps) {
  const router = useRouter();
  const [interviews, setInterviews] = useState<ScheduledInterview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInterviews();
  }, [limit]);

  const loadInterviews = async () => {
    try {
      setLoading(true);
      const data = await getUpcomingInterviews(limit);
      setInterviews(data);
    } catch (err) {
      console.error("Failed to load upcoming interviews:", err);
    } finally {
      setLoading(false);
    }
  };

  const getTimeUntil = (scheduledAt: string): string => {
    const now = new Date();
    const scheduled = new Date(scheduledAt);
    const diffMs = scheduled.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 0) return "Now";
    if (diffMins < 60) return `In ${diffMins}m`;
    if (diffHours < 24) return `In ${diffHours}h`;
    if (diffDays === 1) return "Tomorrow";
    return `In ${diffDays} days`;
  };

  const isStartingSoon = (scheduledAt: string): boolean => {
    const now = new Date();
    const scheduled = new Date(scheduledAt);
    const diffMs = scheduled.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    return diffMins >= -15 && diffMins <= 15; // Within 15 min window
  };

  const handleStartInterview = (interview: ScheduledInterview) => {
    // Navigate to interview page
    router.push(`/candidates/${interview.candidate_id}/interview?room=${interview.room_name}`);
  };

  if (loading) {
    return (
      <div className={`glass-panel rounded-2xl p-6 ${className}`}>
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className={`glass-panel rounded-2xl overflow-hidden ${className}`}>
      {showHeader && (
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white">Upcoming Interviews</h3>
              <p className="text-xs text-white/40">{interviews.length} scheduled</p>
            </div>
          </div>
          <button
            onClick={() => router.push("/dashboard/schedule")}
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
          >
            View All
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {interviews.length === 0 ? (
        <div className="p-8 text-center">
          <Calendar className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/50 text-sm">No upcoming interviews</p>
          <p className="text-white/30 text-xs mt-1">
            Schedule interviews from candidate profiles
          </p>
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {interviews.map((interview) => {
            const startingSoon = interview.scheduled_at && isStartingSoon(interview.scheduled_at);
            return (
              <div
                key={interview.id}
                className={`p-4 hover:bg-white/5 transition-colors ${
                  startingSoon ? "bg-indigo-500/5" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/60 font-medium shrink-0">
                      {interview.candidate_name?.charAt(0)?.toUpperCase() || "?"}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-white truncate">
                        {interview.candidate_name || "Unknown Candidate"}
                      </div>
                      <div className="text-xs text-white/40 truncate">
                        {interview.job_title || "Interview"} · {interview.stage.replace("_", " ")}
                      </div>

                      {/* Time Info */}
                      <div className="flex items-center gap-4 mt-2 text-xs">
                        <div className="flex items-center gap-1 text-white/50">
                          <Calendar className="w-3 h-3" />
                          {interview.scheduled_at
                            ? formatDateTime(interview.scheduled_at, interview.timezone)
                            : "Not scheduled"}
                        </div>
                        <div className="flex items-center gap-1 text-white/50">
                          <Clock className="w-3 h-3" />
                          {interview.duration_minutes}m
                        </div>
                      </div>

                      {/* Interviewer */}
                      {interview.interviewer_name && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-white/40">
                          <User className="w-3 h-3" />
                          {interview.interviewer_name}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col items-end gap-2">
                    {interview.scheduled_at && (
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          startingSoon
                            ? "bg-green-500/20 text-green-300"
                            : "bg-white/5 text-white/50"
                        }`}
                      >
                        {getTimeUntil(interview.scheduled_at)}
                      </span>
                    )}

                    {/* Start Now Button (always available for testing) */}
                    <button
                      onClick={() => handleStartInterview(interview)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        startingSoon
                          ? "bg-green-500 hover:bg-green-400 text-white"
                          : "bg-white/5 hover:bg-white/10 text-white/70"
                      }`}
                    >
                      {startingSoon ? (
                        <>
                          <Video className="w-3 h-3" />
                          Join Now
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3" />
                          Start Early
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
