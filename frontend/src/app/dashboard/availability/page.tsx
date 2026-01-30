"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import {
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
  DAY_LABELS,
  TIMEZONES,
  formatTime,
  getDateString,
  addDays,
} from "@/lib/schedulingApi";
import { getInterviewers, getSelectedInterviewerId, Interviewer } from "@/lib/interviewerApi";
import { tokens } from "@/lib/design-tokens";

// =============================================================================
// SECTION CARD COMPONENT
// =============================================================================

interface SectionCardProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconBgColor: string;
  children: React.ReactNode;
  className?: string;
}

function SectionCard({ title, subtitle, icon, iconBgColor, children, className = "" }: SectionCardProps) {
  return (
    <div
      className={`rounded-2xl border ${className}`}
      style={{
        backgroundColor: tokens.bgCard,
        borderColor: tokens.borderSubtle,
      }}
    >
      <div
        className="flex items-center gap-3 px-5 py-4 border-b"
        style={{ borderColor: tokens.borderSubtle }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: iconBgColor }}
        >
          {icon}
        </div>
        <div>
          <h2 className="text-lg font-medium text-white">{title}</h2>
          {subtitle && (
            <p className="text-xs" style={{ color: tokens.textMuted }}>{subtitle}</p>
          )}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// =============================================================================
// LOADING STATE
// =============================================================================

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: tokens.brandPrimary }} />
      <p className="mt-4 text-sm" style={{ color: tokens.textMuted }}>
        Loading availability settings...
      </p>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function AvailabilitySettingsPage() {
  const { isAuthenticated } = useAuth();

  // State
  const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
  const [selectedInterviewer, setSelectedInterviewer] = useState<Interviewer | null>(null);
  const [weeklySlots, setWeeklySlots] = useState<AvailabilityWeekly[]>([]);
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state for adding slots
  const [newSlotDay, setNewSlotDay] = useState(1);
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

      setWeeklySlots(weeklyData);
      setOverrides(overridesData);
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

  const slotsByDay = weeklySlots.reduce((acc, slot) => {
    const day = slot.day_of_week;
    if (!acc[day]) acc[day] = [];
    acc[day].push(slot);
    return acc;
  }, {} as Record<number, AvailabilityWeekly[]>);

  const inputStyle = {
    backgroundColor: tokens.bgSurface,
    borderColor: tokens.borderSubtle,
    color: tokens.textPrimary,
  };

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-5xl mx-auto">
        {/* Ambient Background */}
        <div
          className="fixed inset-0 pointer-events-none -z-10"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 50% -20%, ${tokens.brandPrimary}15, transparent),
              radial-gradient(ellipse 60% 40% at 100% 0%, ${tokens.brandSecondary}10, transparent),
              ${tokens.bgApp}
            `,
          }}
        />

        {/* Header */}
        <div className="mb-8">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mb-3"
            style={{
              backgroundColor: `${tokens.brandPrimary}15`,
              border: `1px solid ${tokens.brandPrimary}30`,
              color: tokens.brandPrimary,
            }}
          >
            <Calendar className="w-3.5 h-3.5" />
            Scheduling
          </div>
          <h1 className="text-3xl font-light tracking-tight text-white mb-2">
            Availability Settings
          </h1>
          <p style={{ color: tokens.textMuted }}>
            Manage interviewer availability and scheduling preferences
          </p>
        </div>

        {loading ? (
          <LoadingState />
        ) : (
          <>
            {/* Interviewer Selector */}
            <div className="mb-8">
              <label className="block text-sm mb-2" style={{ color: tokens.textMuted }}>
                Select Interviewer
              </label>
              <select
                value={selectedInterviewer?.id || ""}
                onChange={(e) => {
                  const interviewer = interviewers.find((i) => i.id === e.target.value);
                  setSelectedInterviewer(interviewer || null);
                }}
                className="w-full max-w-md px-4 py-3 border rounded-xl focus:outline-none focus:ring-2"
                style={{
                  ...inputStyle,
                  focusRing: tokens.brandPrimary,
                }}
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
              <div
                className="mb-6 p-4 rounded-xl flex items-center gap-3 border"
                style={{
                  backgroundColor: tokens.statusDangerBg,
                  borderColor: `${tokens.statusDanger}30`,
                }}
              >
                <AlertCircle className="w-5 h-5" style={{ color: tokens.statusDanger }} />
                <span style={{ color: tokens.statusDanger }}>{error}</span>
              </div>
            )}
            {success && (
              <div
                className="mb-6 p-4 rounded-xl flex items-center gap-3 border"
                style={{
                  backgroundColor: tokens.statusSuccessBg,
                  borderColor: `${tokens.statusSuccess}30`,
                }}
              >
                <CheckCircle className="w-5 h-5" style={{ color: tokens.statusSuccess }} />
                <span style={{ color: tokens.statusSuccess }}>{success}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Settings Panel */}
              <SectionCard
                title="Preferences"
                icon={<Settings className="w-5 h-5" style={{ color: tokens.brandPrimary }} />}
                iconBgColor={`${tokens.brandPrimary}20`}
              >
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs mb-2" style={{ color: tokens.textMuted }}>
                      Timezone
                    </label>
                    <select
                      value={editTimezone}
                      onChange={(e) => setEditTimezone(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none"
                      style={inputStyle}
                    >
                      {TIMEZONES.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                          {tz.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs mb-2" style={{ color: tokens.textMuted }}>
                      Default Interview Duration
                    </label>
                    <select
                      value={editDuration}
                      onChange={(e) => setEditDuration(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none"
                      style={inputStyle}
                    >
                      <option value={30}>30 minutes</option>
                      <option value={45}>45 minutes</option>
                      <option value={60}>60 minutes</option>
                      <option value={90}>90 minutes</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs mb-2" style={{ color: tokens.textMuted }}>
                      Max Interviews Per Day
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={editMaxPerDay}
                      onChange={(e) => setEditMaxPerDay(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none"
                      style={inputStyle}
                    />
                  </div>

                  <button
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="w-full py-2.5 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                    style={{
                      backgroundColor: saving ? tokens.bgSurface : tokens.brandPrimary,
                      color: saving ? tokens.textMuted : "white",
                    }}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Preferences
                  </button>
                </div>
              </SectionCard>

              {/* Weekly Availability Panel */}
              <SectionCard
                title="Weekly Schedule"
                icon={<Calendar className="w-5 h-5" style={{ color: tokens.statusSuccess }} />}
                iconBgColor={`${tokens.statusSuccess}20`}
              >
                {/* Add Slot Form */}
                <div
                  className="p-4 rounded-xl mb-4"
                  style={{ backgroundColor: tokens.bgSurface }}
                >
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    <select
                      value={newSlotDay}
                      onChange={(e) => setNewSlotDay(Number(e.target.value))}
                      className="col-span-2 px-2 py-2 border rounded-lg text-sm"
                      style={inputStyle}
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
                      className="px-2 py-2 border rounded-lg text-sm"
                      style={inputStyle}
                    />
                    <input
                      type="time"
                      value={newSlotEnd}
                      onChange={(e) => setNewSlotEnd(e.target.value)}
                      className="px-2 py-2 border rounded-lg text-sm"
                      style={inputStyle}
                    />
                  </div>
                  <button
                    onClick={handleAddWeeklySlot}
                    disabled={saving}
                    className="w-full py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    style={{
                      backgroundColor: saving ? tokens.bgSurface : tokens.statusSuccess,
                      color: saving ? tokens.textMuted : "white",
                    }}
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
                        <div className="w-20 text-xs pt-2" style={{ color: tokens.textMuted }}>
                          {DAY_LABELS[Number(day)]}
                        </div>
                        <div className="flex-1 space-y-1">
                          {slots.map((slot) => (
                            <div
                              key={slot.id}
                              className="flex items-center justify-between p-2 rounded-lg"
                              style={{ backgroundColor: tokens.bgSurface }}
                            >
                              <span className="text-sm text-white">
                                {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                              </span>
                              <button
                                onClick={() => handleDeleteWeeklySlot(slot.id)}
                                className="p-1 rounded transition-colors"
                                style={{ color: tokens.statusDanger }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  {weeklySlots.length === 0 && (
                    <div className="text-center py-8 text-sm" style={{ color: tokens.textMuted }}>
                      No weekly availability set
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Overrides Panel */}
              <SectionCard
                title="Date Overrides"
                subtitle="Block time off or add extra availability"
                icon={<Clock className="w-5 h-5" style={{ color: tokens.statusWarning }} />}
                iconBgColor={`${tokens.statusWarning}20`}
                className="lg:col-span-2"
              >
                {/* Add Override Form */}
                <div
                  className="p-4 rounded-xl mb-4"
                  style={{ backgroundColor: tokens.bgSurface }}
                >
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
                    <input
                      type="date"
                      value={newOverrideDate}
                      onChange={(e) => setNewOverrideDate(e.target.value)}
                      className="px-3 py-2 border rounded-lg text-sm"
                      style={inputStyle}
                    />
                    <select
                      value={newOverrideType}
                      onChange={(e) => setNewOverrideType(e.target.value as any)}
                      className="px-3 py-2 border rounded-lg text-sm"
                      style={inputStyle}
                    >
                      <option value="unavailable">Unavailable</option>
                      <option value="available">Available</option>
                    </select>
                    <input
                      type="time"
                      value={newOverrideStart}
                      onChange={(e) => setNewOverrideStart(e.target.value)}
                      placeholder="Start (optional)"
                      className="px-3 py-2 border rounded-lg text-sm"
                      style={inputStyle}
                    />
                    <input
                      type="time"
                      value={newOverrideEnd}
                      onChange={(e) => setNewOverrideEnd(e.target.value)}
                      placeholder="End (optional)"
                      className="px-3 py-2 border rounded-lg text-sm"
                      style={inputStyle}
                    />
                    <input
                      type="text"
                      value={newOverrideReason}
                      onChange={(e) => setNewOverrideReason(e.target.value)}
                      placeholder="Reason (optional)"
                      className="px-3 py-2 border rounded-lg text-sm"
                      style={inputStyle}
                    />
                  </div>
                  <button
                    onClick={handleAddOverride}
                    disabled={saving}
                    className="w-full py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    style={{
                      backgroundColor: saving ? tokens.bgSurface : tokens.statusWarning,
                      color: saving ? tokens.textMuted : "white",
                    }}
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
                      className="p-3 rounded-xl border"
                      style={{
                        backgroundColor: override.override_type === "unavailable"
                          ? tokens.statusDangerBg
                          : tokens.statusSuccessBg,
                        borderColor: override.override_type === "unavailable"
                          ? `${tokens.statusDanger}30`
                          : `${tokens.statusSuccess}30`,
                      }}
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
                          <div className="text-xs mt-1" style={{ color: tokens.textMuted }}>
                            {override.start_time && override.end_time
                              ? `${formatTime(override.start_time)} - ${formatTime(override.end_time)}`
                              : "All Day"}
                          </div>
                          {override.reason && (
                            <div className="text-xs mt-1" style={{ color: tokens.textMuted }}>
                              {override.reason}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteOverride(override.id)}
                          className="p-1 rounded transition-colors"
                          style={{ color: tokens.textMuted }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {overrides.length === 0 && (
                    <div className="col-span-full text-center py-8 text-sm" style={{ color: tokens.textMuted }}>
                      No overrides set
                    </div>
                  )}
                </div>
              </SectionCard>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
