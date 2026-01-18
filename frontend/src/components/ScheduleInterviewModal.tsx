"use client";

import { useState, useEffect } from "react";
import {
  X,
  Calendar,
  Clock,
  User,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import {
  getAvailableSlots,
  scheduleInterview,
  TimeSlot,
  TIMEZONES,
  formatTime,
  getDateString,
  addDays,
} from "@/lib/schedulingApi";
import { getInterviewers, Interviewer } from "@/lib/interviewerApi";

interface ScheduleInterviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScheduled: () => void;
  candidateId: string;
  candidateName: string;
  jobId: string;
  jobTitle: string;
  stage?: string;
}

export default function ScheduleInterviewModal({
  isOpen,
  onClose,
  onScheduled,
  candidateId,
  candidateName,
  jobId,
  jobTitle,
  stage = "round_1",
}: ScheduleInterviewModalProps) {
  // State
  const [step, setStep] = useState<"interviewer" | "datetime" | "confirm">("interviewer");
  const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
  const [selectedInterviewer, setSelectedInterviewer] = useState<Interviewer | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [duration, setDuration] = useState(45);
  const [timezone, setTimezone] = useState("America/New_York");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load interviewers
  useEffect(() => {
    if (isOpen) {
      loadInterviewers();
    }
  }, [isOpen]);

  // Load available slots when interviewer or date changes
  useEffect(() => {
    if (selectedInterviewer && step === "datetime") {
      loadAvailableSlots();
    }
  }, [selectedInterviewer, selectedDate, duration, step]);

  const loadInterviewers = async () => {
    try {
      const data = await getInterviewers();
      setInterviewers(data);
    } catch (err) {
      console.error("Failed to load interviewers:", err);
    }
  };

  const loadAvailableSlots = async () => {
    if (!selectedInterviewer) return;

    setSlotsLoading(true);
    try {
      const dateStr = getDateString(selectedDate);
      const slots = await getAvailableSlots(
        selectedInterviewer.id,
        dateStr,
        dateStr,
        duration,
        timezone
      );
      setAvailableSlots(slots);
    } catch (err) {
      console.error("Failed to load slots:", err);
      setAvailableSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleSchedule = async () => {
    if (!selectedInterviewer || !selectedSlot) return;

    setLoading(true);
    setError(null);

    try {
      await scheduleInterview({
        candidate_id: candidateId,
        job_posting_id: jobId,
        interviewer_id: selectedInterviewer.id,
        stage,
        scheduled_at: selectedSlot.start,
        duration_minutes: duration,
        timezone,
        interview_type: "live",
        notes: notes || undefined,
      });

      setSuccess(true);
      setTimeout(() => {
        onScheduled();
        handleClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to schedule interview");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep("interviewer");
    setSelectedInterviewer(null);
    setSelectedSlot(null);
    setNotes("");
    setError(null);
    setSuccess(false);
    onClose();
  };

  const goToNextDay = () => {
    setSelectedDate(addDays(selectedDate, 1));
    setSelectedSlot(null);
  };

  const goToPrevDay = () => {
    const yesterday = addDays(selectedDate, -1);
    if (yesterday >= new Date(new Date().setHours(0, 0, 0, 0))) {
      setSelectedDate(yesterday);
      setSelectedSlot(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-[#0a0a0f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-lg font-medium text-white">Schedule Interview</h2>
            <p className="text-sm text-white/50 mt-1">
              {candidateName} - {jobTitle}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Success State */}
          {success ? (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-white mb-2">Interview Scheduled!</h3>
              <p className="text-white/50">The interview has been added to the calendar.</p>
            </div>
          ) : (
            <>
              {/* Step 1: Select Interviewer */}
              {step === "interviewer" && (
                <div className="space-y-4">
                  <label className="block text-sm text-white/60">Select Interviewer</label>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {interviewers.map((interviewer) => (
                      <button
                        key={interviewer.id}
                        onClick={() => setSelectedInterviewer(interviewer)}
                        className={`w-full p-4 rounded-xl border transition-all text-left ${
                          selectedInterviewer?.id === interviewer.id
                            ? "border-indigo-500 bg-indigo-500/10"
                            : "border-white/10 hover:border-white/20 bg-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                            <span className="text-sm font-medium text-white">
                              {interviewer.name.split(" ").map((n) => n[0]).join("")}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-white">{interviewer.name}</div>
                            <div className="text-xs text-white/40">
                              {interviewer.team} · {interviewer.department}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Duration & Timezone */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                    <div>
                      <label className="block text-xs text-white/50 mb-2">Duration</label>
                      <select
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
                      >
                        <option value={30}>30 minutes</option>
                        <option value={45}>45 minutes</option>
                        <option value={60}>60 minutes</option>
                        <option value={90}>90 minutes</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-white/50 mb-2">Timezone</label>
                      <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
                      >
                        {TIMEZONES.map((tz) => (
                          <option key={tz.value} value={tz.value}>
                            {tz.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={() => setStep("datetime")}
                    disabled={!selectedInterviewer}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/10 disabled:text-white/30 text-white font-medium rounded-xl transition-colors"
                  >
                    Continue
                  </button>
                </div>
              )}

              {/* Step 2: Select Date/Time */}
              {step === "datetime" && (
                <div className="space-y-4">
                  {/* Date Navigation */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={goToPrevDay}
                      className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5 text-white/60" />
                    </button>
                    <div className="text-center">
                      <div className="text-lg font-medium text-white">
                        {selectedDate.toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        })}
                      </div>
                      <div className="text-xs text-white/40">
                        {selectedInterviewer?.name}'s availability
                      </div>
                    </div>
                    <button
                      onClick={goToNextDay}
                      className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                    >
                      <ChevronRight className="w-5 h-5 text-white/60" />
                    </button>
                  </div>

                  {/* Time Slots */}
                  <div className="min-h-[200px]">
                    {slotsLoading ? (
                      <div className="flex items-center justify-center h-48">
                        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                      </div>
                    ) : availableSlots.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-48 text-center">
                        <Calendar className="w-12 h-12 text-white/20 mb-3" />
                        <p className="text-white/50">No available slots on this day</p>
                        <p className="text-xs text-white/30 mt-1">
                          Try another date or check interviewer availability
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                        {availableSlots.map((slot, idx) => {
                          const startTime = new Date(slot.start);
                          const timeStr = startTime.toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                            timeZone: timezone,
                          });
                          return (
                            <button
                              key={idx}
                              onClick={() => setSelectedSlot(slot)}
                              className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                                selectedSlot === slot
                                  ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                                  : "border-white/10 hover:border-white/20 text-white/70 hover:text-white"
                              }`}
                            >
                              {timeStr}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs text-white/50 mb-2">Notes (optional)</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any notes for the interviewer..."
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-indigo-500 resize-none h-20"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep("interviewer")}
                      className="flex-1 py-3 border border-white/10 hover:bg-white/5 text-white font-medium rounded-xl transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setStep("confirm")}
                      disabled={!selectedSlot}
                      className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/10 disabled:text-white/30 text-white font-medium rounded-xl transition-colors"
                    >
                      Review
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Confirm */}
              {step === "confirm" && selectedSlot && (
                <div className="space-y-4">
                  <div className="bg-white/5 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-indigo-400" />
                      <div>
                        <div className="text-xs text-white/40">Interviewer</div>
                        <div className="text-white font-medium">{selectedInterviewer?.name}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-indigo-400" />
                      <div>
                        <div className="text-xs text-white/40">Date & Time</div>
                        <div className="text-white font-medium">
                          {new Date(selectedSlot.start).toLocaleString("en-US", {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                            timeZone: timezone,
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-indigo-400" />
                      <div>
                        <div className="text-xs text-white/40">Duration</div>
                        <div className="text-white font-medium">{duration} minutes</div>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      <span className="text-sm text-red-300">{error}</span>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep("datetime")}
                      disabled={loading}
                      className="flex-1 py-3 border border-white/10 hover:bg-white/5 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleSchedule}
                      disabled={loading}
                      className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Scheduling...
                        </>
                      ) : (
                        "Schedule Interview"
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
