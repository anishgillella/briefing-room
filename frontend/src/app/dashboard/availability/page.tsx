"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Plus,
  Trash2,
  Settings,
  Loader2,
  Save,
  AlertCircle,
  CheckCircle,
  Globe,
} from "lucide-react";
import {
  getWeeklyAvailability,
  createWeeklySlot,
  deleteWeeklySlot,
  getAvailabilityOverrides,
  createAvailabilityOverride,
  deleteAvailabilityOverride,
  getInterviewerSettings,
  updateInterviewerSettings,
  AvailabilityWeekly,
  AvailabilityOverride,
  InterviewerSettings,
  DAY_LABELS,
  TIMEZONES,
  formatTime,
  getDateString,
  addDays,
} from "@/lib/schedulingApi";
import { getInterviewers, getSelectedInterviewerId, Interviewer } from "@/lib/interviewerApi";

export default function AvailabilitySettingsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // State
  const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
  const [selectedInterviewer, setSelectedInterviewer] = useState<Interviewer | null>(null);
  const [settings, setSettings] = useState<InterviewerSettings | null>(null);
  const [weeklySlots, setWeeklySlots] = useState<AvailabilityWeekly[]>([]);
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state for adding slots
  const [newSlotDay, setNewSlotDay] = useState(1); // Monday
  const [newSlotStart, setNewSlotStart] = useState("09:00");
  const [newSlotEnd, setNewSlotEnd] = useState("17:00");

  // Form state for adding overrides
  const [newOverrideDate, setNewOverrideDate] = useState(getDateString(new Date()));
  const [newOverrideType, setNewOverrideType] = useState<"available" | "unavailable">("unavailable");
  const [newOverrideStart, setNewOverrideStart] = useState("");
  const [newOverrideEnd, setNewOverrideEnd] = useState("");
  const [newOverrideReason, setNewOverrideReason] = useState("");

  // Settings form
  const [editTimezone, setEditTimezone] = useState("America/New_York");
  const [editDuration, setEditDuration] = useState(45);
  const [editMaxPerDay, setEditMaxPerDay] = useState(5);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadInterviewers();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (selectedInterviewer) {
      loadInterviewerData();
    }
  }, [selectedInterviewer]);

  const loadInterviewers = async () => {
    try {
      const data = await getInterviewers();
      setInterviewers(data);

      // Auto-select saved interviewer
      const savedId = getSelectedInterviewerId();
      if (savedId) {
        const saved = data.find((i) => i.id === savedId);
        if (saved) setSelectedInterviewer(saved);
      } else if (data.length > 0) {
        setSelectedInterviewer(data[0]);
      }
    } catch (err) {
      console.error("Failed to load interviewers:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadInterviewerData = async () => {
    if (!selectedInterviewer) return;

    setLoading(true);
    try {
      const [settingsData, weeklyData, overridesData] = await Promise.all([
        getInterviewerSettings(selectedInterviewer.id),
        getWeeklyAvailability(selectedInterviewer.id),
        getAvailabilityOverrides(
          selectedInterviewer.id,
          getDateString(new Date()),
          getDateString(addDays(new Date(), 60))
        ),
      ]);

      setSettings(settingsData);
      setWeeklySlots(weeklyData);
      setOverrides(overridesData);

      // Update form with settings
      setEditTimezone(settingsData.timezone);
      setEditDuration(settingsData.default_interview_duration_minutes);
      setEditMaxPerDay(settingsData.max_interviews_per_day);
    } catch (err) {
      console.error("Failed to load interviewer data:", err);
      setError("Failed to load availability data");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!selectedInterviewer) return;

    setSaving(true);
    setError(null);
    try {
      await updateInterviewerSettings(selectedInterviewer.id, {
        timezone: editTimezone,
        default_interview_duration_minutes: editDuration,
        max_interviews_per_day: editMaxPerDay,
      });
      setSuccess("Settings saved!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleAddWeeklySlot = async () => {
    if (!selectedInterviewer) return;

    setSaving(true);
    setError(null);
    try {
      await createWeeklySlot(selectedInterviewer.id, newSlotDay, newSlotStart, newSlotEnd);
      await loadInterviewerData();
      setSuccess("Availability slot added!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to add slot");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWeeklySlot = async (slotId: string) => {
    setSaving(true);
    setError(null);
    try {
      await deleteWeeklySlot(slotId);
      setWeeklySlots(weeklySlots.filter((s) => s.id !== slotId));
      setSuccess("Slot deleted!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to delete slot");
    } finally {
      setSaving(false);
    }
  };

  const handleAddOverride = async () => {
    if (!selectedInterviewer) return;

    setSaving(true);
    setError(null);
    try {
      await createAvailabilityOverride(
        selectedInterviewer.id,
        newOverrideDate,
        newOverrideType,
        newOverrideStart || undefined,
        newOverrideEnd || undefined,
        newOverrideReason || undefined
      );
      await loadInterviewerData();
      setNewOverrideReason("");
      setNewOverrideStart("");
      setNewOverrideEnd("");
      setSuccess("Override added!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to add override");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOverride = async (overrideId: string) => {
    setSaving(true);
    setError(null);
    try {
      await deleteAvailabilityOverride(overrideId);
      setOverrides(overrides.filter((o) => o.id !== overrideId));
      setSuccess("Override deleted!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to delete override");
    } finally {
      setSaving(false);
    }
  };

  // Group weekly slots by day
  const slotsByDay = weeklySlots.reduce((acc, slot) => {
    const day = slot.day_of_week;
    if (!acc[day]) acc[day] = [];
    acc[day].push(slot);
    return acc;
  }, {} as Record<number, AvailabilityWeekly[]>);

  if (authLoading || loading) {
    return (
      <main className="min-h-screen gradient-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen gradient-bg text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#000000]/80 backdrop-blur-md border-b border-white/5 py-4">
        <div className="flex items-center justify-between max-w-5xl mx-auto px-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="p-2 hover:bg-white/5 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-white/60" />
            </Link>
            <div>
              <h1 className="text-lg font-light tracking-wide text-white">Availability Settings</h1>
              <p className="text-xs text-white/50">Manage interviewer availability</p>
            </div>
          </div>
        </div>
      </header>

      <div className="pt-28 px-6 pb-12 max-w-5xl mx-auto">
        {/* Interviewer Selector */}
        <div className="mb-8">
          <label className="block text-sm text-white/60 mb-2">Select Interviewer</label>
          <select
            value={selectedInterviewer?.id || ""}
            onChange={(e) => {
              const interviewer = interviewers.find((i) => i.id === e.target.value);
              setSelectedInterviewer(interviewer || null);
            }}
            className="w-full max-w-md px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
          >
            {interviewers.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} - {i.team}
              </option>
            ))}
          </select>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-300">{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-green-300">{success}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Settings Panel */}
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                <Settings className="w-5 h-5 text-indigo-400" />
              </div>
              <h2 className="text-lg font-medium text-white">Preferences</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-white/50 mb-2">Timezone</label>
                <select
                  value={editTimezone}
                  onChange={(e) => setEditTimezone(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-white/50 mb-2">Default Interview Duration</label>
                <select
                  value={editDuration}
                  onChange={(e) => setEditDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                  <option value={90}>90 minutes</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-white/50 mb-2">Max Interviews Per Day</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={editMaxPerDay}
                  onChange={(e) => setEditMaxPerDay(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/10 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Preferences
              </button>
            </div>
          </div>

          {/* Weekly Availability Panel */}
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-green-400" />
              </div>
              <h2 className="text-lg font-medium text-white">Weekly Schedule</h2>
            </div>

            {/* Add Slot Form */}
            <div className="p-4 bg-white/5 rounded-xl mb-4">
              <div className="grid grid-cols-4 gap-2 mb-3">
                <select
                  value={newSlotDay}
                  onChange={(e) => setNewSlotDay(Number(e.target.value))}
                  className="col-span-2 px-2 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                >
                  {DAY_LABELS.map((day, idx) => (
                    <option key={idx} value={idx}>
                      {day}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  value={newSlotStart}
                  onChange={(e) => setNewSlotStart(e.target.value)}
                  className="px-2 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                />
                <input
                  type="time"
                  value={newSlotEnd}
                  onChange={(e) => setNewSlotEnd(e.target.value)}
                  className="px-2 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                />
              </div>
              <button
                onClick={handleAddWeeklySlot}
                disabled={saving}
                className="w-full py-2 bg-green-600 hover:bg-green-500 disabled:bg-white/10 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Time Slot
              </button>
            </div>

            {/* Existing Slots */}
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {Object.entries(slotsByDay)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([day, slots]) => (
                  <div key={day} className="flex items-start gap-3">
                    <div className="w-20 text-xs text-white/50 pt-2">{DAY_LABELS[Number(day)]}</div>
                    <div className="flex-1 space-y-1">
                      {slots.map((slot) => (
                        <div
                          key={slot.id}
                          className="flex items-center justify-between p-2 bg-white/5 rounded-lg"
                        >
                          <span className="text-sm text-white">
                            {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                          </span>
                          <button
                            onClick={() => handleDeleteWeeklySlot(slot.id)}
                            className="p-1 hover:bg-red-500/20 rounded text-red-400"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              {weeklySlots.length === 0 && (
                <div className="text-center py-8 text-white/40 text-sm">
                  No weekly availability set
                </div>
              )}
            </div>
          </div>

          {/* Overrides Panel */}
          <div className="glass-panel rounded-2xl p-6 lg:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h2 className="text-lg font-medium text-white">Date Overrides</h2>
                <p className="text-xs text-white/40">Block time off or add extra availability</p>
              </div>
            </div>

            {/* Add Override Form */}
            <div className="p-4 bg-white/5 rounded-xl mb-4">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
                <input
                  type="date"
                  value={newOverrideDate}
                  onChange={(e) => setNewOverrideDate(e.target.value)}
                  className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                />
                <select
                  value={newOverrideType}
                  onChange={(e) => setNewOverrideType(e.target.value as any)}
                  className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                >
                  <option value="unavailable">Unavailable</option>
                  <option value="available">Available</option>
                </select>
                <input
                  type="time"
                  value={newOverrideStart}
                  onChange={(e) => setNewOverrideStart(e.target.value)}
                  placeholder="Start (optional)"
                  className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                />
                <input
                  type="time"
                  value={newOverrideEnd}
                  onChange={(e) => setNewOverrideEnd(e.target.value)}
                  placeholder="End (optional)"
                  className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                />
                <input
                  type="text"
                  value={newOverrideReason}
                  onChange={(e) => setNewOverrideReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                />
              </div>
              <button
                onClick={handleAddOverride}
                disabled={saving}
                className="w-full py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-white/10 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Override
              </button>
            </div>

            {/* Existing Overrides */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {overrides.map((override) => (
                <div
                  key={override.id}
                  className={`p-3 rounded-xl border ${
                    override.override_type === "unavailable"
                      ? "bg-red-500/10 border-red-500/20"
                      : "bg-green-500/10 border-green-500/20"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-medium text-white">
                        {new Date(override.override_date + "T00:00:00").toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                      <div className="text-xs text-white/50 mt-1">
                        {override.start_time && override.end_time
                          ? `${formatTime(override.start_time)} - ${formatTime(override.end_time)}`
                          : "All Day"}
                      </div>
                      {override.reason && (
                        <div className="text-xs text-white/40 mt-1">{override.reason}</div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteOverride(override.id)}
                      className="p-1 hover:bg-white/10 rounded"
                    >
                      <Trash2 className="w-3 h-3 text-white/40" />
                    </button>
                  </div>
                </div>
              ))}
              {overrides.length === 0 && (
                <div className="col-span-full text-center py-8 text-white/40 text-sm">
                  No overrides set
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
