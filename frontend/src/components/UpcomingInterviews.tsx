"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clock,
  User,
  Play,
  ChevronRight,
  CalendarDays,
  Video,
} from "lucide-react";
import {
  getUpcomingInterviews,
  ScheduledInterview,
  formatDateTime,
} from "@/lib/schedulingApi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

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
    return diffMins >= -15 && diffMins <= 15;
  };

  const handleStartInterview = (interview: ScheduledInterview) => {
    router.push(`/candidates/${interview.candidate_id}/interview?room=${interview.room_name}`);
  };

  if (loading) {
    return (
      <Card padding="lg" className={className}>
        <div className="flex items-center justify-center h-32">
          <Spinner />
        </div>
      </Card>
    );
  }

  return (
    <Card padding="none" className={cn("overflow-hidden", className)}>
      {showHeader && (
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white">
                Upcoming Interviews
              </h3>
              <p className="text-xs text-zinc-500">
                {interviews.length} scheduled
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push("/dashboard/schedule")}
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
          >
            View All
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {interviews.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-8 text-center"
          >
            <motion.div
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center mx-auto mb-4 border border-white/5"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Calendar className="w-7 h-7 text-indigo-400" />
            </motion.div>
            <p className="text-zinc-400 text-sm">No upcoming interviews</p>
            <p className="text-zinc-600 text-xs mt-1">
              Schedule interviews from candidate profiles
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="divide-y divide-white/[0.04]"
          >
            {interviews.map((interview, index) => {
              const startingSoon =
                interview.scheduled_at && isStartingSoon(interview.scheduled_at);
              return (
                <motion.div
                  key={interview.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "p-4 hover:bg-white/[0.03] transition-colors",
                    startingSoon && "bg-emerald-500/5"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <UserAvatar
                        name={interview.candidate_name || "?"}
                        size="sm"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-white truncate">
                          {interview.candidate_name || "Unknown Candidate"}
                        </div>
                        <div className="text-xs text-zinc-500 truncate">
                          {interview.job_title || "Interview"} ·{" "}
                          {interview.stage.replace("_", " ")}
                        </div>

                        <div className="flex items-center gap-4 mt-2 text-xs">
                          <div className="flex items-center gap-1 text-zinc-500">
                            <Calendar className="w-3 h-3" />
                            {interview.scheduled_at
                              ? formatDateTime(
                                  interview.scheduled_at,
                                  interview.timezone
                                )
                              : "Not scheduled"}
                          </div>
                          <div className="flex items-center gap-1 text-zinc-500">
                            <Clock className="w-3 h-3" />
                            {interview.duration_minutes}m
                          </div>
                        </div>

                        {interview.interviewer_name && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-zinc-600">
                            <User className="w-3 h-3" />
                            {interview.interviewer_name}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {interview.scheduled_at && (
                        <span
                          className={cn(
                            "text-xs px-2 py-1 rounded-full",
                            startingSoon
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-white/5 text-zinc-500"
                          )}
                        >
                          {getTimeUntil(interview.scheduled_at)}
                        </span>
                      )}

                      <Button
                        variant={startingSoon ? "success" : "ghost"}
                        size="sm"
                        onClick={() => handleStartInterview(interview)}
                        leftIcon={
                          startingSoon ? (
                            <Video className="w-3 h-3" />
                          ) : (
                            <Play className="w-3 h-3" />
                          )
                        }
                        className="text-xs"
                      >
                        {startingSoon ? "Join Now" : "Start Early"}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
