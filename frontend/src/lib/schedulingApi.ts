/**
 * Scheduling API - Interview scheduling and availability management
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Types

export interface TimeSlot {
  start: string;
  end: string;
  interviewer_id: string;
  interviewer_name?: string;
  is_available: boolean;
}

export interface AvailabilityWeekly {
  id: string;
  interviewer_id: string;
  day_of_week: number; // 0 = Sunday, 6 = Saturday
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AvailabilityOverride {
  id: string;
  interviewer_id: string;
  override_date: string;
  override_type: 'available' | 'unavailable';
  start_time?: string;
  end_time?: string;
  reason?: string;
  created_at?: string;
}

export interface InterviewerSettings {
  interviewer_id: string;
  timezone: string;
  default_interview_duration_minutes: number;
  max_interviews_per_day: number;
}

export interface ScheduledInterview {
  id: string;
  candidate_id: string;
  job_posting_id?: string;
  interviewer_id?: string;
  stage: string;
  interview_type: string;
  scheduled_at?: string;
  duration_minutes: number;
  timezone: string;
  meeting_link?: string;
  room_name?: string;
  status: string;
  started_at?: string;
  ended_at?: string;
  notes?: string;
  cancel_reason?: string;
  reminder_sent_at?: string;
  candidate_name?: string;
  candidate_email?: string;
  interviewer_name?: string;
  interviewer_email?: string;
  job_title?: string;
  created_at: string;
}

export interface ScheduleInterviewRequest {
  candidate_id: string;
  job_posting_id: string;
  interviewer_id: string;
  stage: string;
  scheduled_at: string;
  duration_minutes?: number;
  timezone?: string;
  interview_type?: string;
  notes?: string;
}

// Helper to get auth headers
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return headers;
}

// Day of week labels
export const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Common timezones
export const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (no DST)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central European (CET)' },
  { value: 'Asia/Tokyo', label: 'Japan (JST)' },
  { value: 'Asia/Shanghai', label: 'China (CST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
];

// ============================================
// INTERVIEWER SETTINGS
// ============================================

export async function getInterviewerSettings(interviewerId: string): Promise<InterviewerSettings> {
  const response = await fetch(
    `${API_BASE}/api/scheduling/interviewers/${interviewerId}/settings`,
    { headers: getAuthHeaders() }
  );
  if (!response.ok) {
    throw new Error('Failed to fetch interviewer settings');
  }
  return response.json();
}

export async function updateInterviewerSettings(
  interviewerId: string,
  updates: Partial<InterviewerSettings>
): Promise<InterviewerSettings> {
  const response = await fetch(
    `${API_BASE}/api/scheduling/interviewers/${interviewerId}/settings`,
    {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    }
  );
  if (!response.ok) {
    throw new Error('Failed to update interviewer settings');
  }
  return response.json();
}

// ============================================
// WEEKLY AVAILABILITY
// ============================================

export async function getWeeklyAvailability(interviewerId: string): Promise<AvailabilityWeekly[]> {
  const response = await fetch(
    `${API_BASE}/api/scheduling/interviewers/${interviewerId}/availability/weekly`,
    { headers: getAuthHeaders() }
  );
  if (!response.ok) {
    throw new Error('Failed to fetch weekly availability');
  }
  return response.json();
}

export async function createWeeklySlot(
  interviewerId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string
): Promise<AvailabilityWeekly> {
  const params = new URLSearchParams({
    day_of_week: dayOfWeek.toString(),
    start_time: startTime,
    end_time: endTime,
  });
  const response = await fetch(
    `${API_BASE}/api/scheduling/interviewers/${interviewerId}/availability/weekly?${params}`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
    }
  );
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create availability slot');
  }
  return response.json();
}

export async function deleteWeeklySlot(slotId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE}/api/scheduling/availability/weekly/${slotId}`,
    {
      method: 'DELETE',
      headers: getAuthHeaders(),
    }
  );
  if (!response.ok) {
    throw new Error('Failed to delete availability slot');
  }
}

// ============================================
// AVAILABILITY OVERRIDES
// ============================================

export async function getAvailabilityOverrides(
  interviewerId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<AvailabilityOverride[]> {
  const params = new URLSearchParams();
  if (dateFrom) params.append('date_from', dateFrom);
  if (dateTo) params.append('date_to', dateTo);

  const url = `${API_BASE}/api/scheduling/interviewers/${interviewerId}/availability/overrides${params.toString() ? '?' + params : ''}`;
  const response = await fetch(url, { headers: getAuthHeaders() });
  if (!response.ok) {
    throw new Error('Failed to fetch availability overrides');
  }
  return response.json();
}

export async function createAvailabilityOverride(
  interviewerId: string,
  overrideDate: string,
  overrideType: 'available' | 'unavailable',
  startTime?: string,
  endTime?: string,
  reason?: string
): Promise<AvailabilityOverride> {
  const params = new URLSearchParams({
    override_date: overrideDate,
    override_type: overrideType,
  });
  if (startTime) params.append('start_time', startTime);
  if (endTime) params.append('end_time', endTime);
  if (reason) params.append('reason', reason);

  const response = await fetch(
    `${API_BASE}/api/scheduling/interviewers/${interviewerId}/availability/overrides?${params}`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
    }
  );
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create override');
  }
  return response.json();
}

export async function deleteAvailabilityOverride(overrideId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE}/api/scheduling/availability/overrides/${overrideId}`,
    {
      method: 'DELETE',
      headers: getAuthHeaders(),
    }
  );
  if (!response.ok) {
    throw new Error('Failed to delete override');
  }
}

// ============================================
// AVAILABLE SLOTS
// ============================================

export async function getAvailableSlots(
  interviewerId: string,
  dateFrom: string,
  dateTo: string,
  durationMinutes: number = 45,
  timezone: string = 'America/New_York'
): Promise<TimeSlot[]> {
  const params = new URLSearchParams({
    date_from: dateFrom,
    date_to: dateTo,
    duration_minutes: durationMinutes.toString(),
    timezone,
  });

  const response = await fetch(
    `${API_BASE}/api/scheduling/interviewers/${interviewerId}/slots?${params}`,
    { headers: getAuthHeaders() }
  );
  if (!response.ok) {
    throw new Error('Failed to fetch available slots');
  }
  const data = await response.json();
  return data.slots;
}

// ============================================
// INTERVIEW SCHEDULING
// ============================================

export async function scheduleInterview(request: ScheduleInterviewRequest): Promise<ScheduledInterview> {
  const response = await fetch(`${API_BASE}/api/scheduling/interviews`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to schedule interview');
  }
  return response.json();
}

export async function getScheduledInterviews(
  interviewerId?: string,
  dateFrom?: string,
  dateTo?: string,
  status: string = 'scheduled'
): Promise<ScheduledInterview[]> {
  const params = new URLSearchParams({ status });
  if (interviewerId) params.append('interviewer_id', interviewerId);
  if (dateFrom) params.append('date_from', dateFrom);
  if (dateTo) params.append('date_to', dateTo);

  const response = await fetch(
    `${API_BASE}/api/scheduling/interviews?${params}`,
    { headers: getAuthHeaders() }
  );
  if (!response.ok) {
    throw new Error('Failed to fetch scheduled interviews');
  }
  return response.json();
}

export async function getUpcomingInterviews(limit: number = 10): Promise<ScheduledInterview[]> {
  const response = await fetch(
    `${API_BASE}/api/scheduling/interviews/upcoming?limit=${limit}`,
    { headers: getAuthHeaders() }
  );
  if (!response.ok) {
    throw new Error('Failed to fetch upcoming interviews');
  }
  return response.json();
}

export async function rescheduleInterview(
  interviewId: string,
  newScheduledAt: string,
  newInterviewerId?: string,
  reason?: string
): Promise<ScheduledInterview> {
  const response = await fetch(
    `${API_BASE}/api/scheduling/interviews/${interviewId}/reschedule`,
    {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        new_scheduled_at: newScheduledAt,
        new_interviewer_id: newInterviewerId,
        reason,
      }),
    }
  );
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to reschedule interview');
  }
  return response.json();
}

export async function cancelInterview(interviewId: string, reason?: string): Promise<void> {
  const response = await fetch(
    `${API_BASE}/api/scheduling/interviews/${interviewId}/cancel`,
    {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason }),
    }
  );
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to cancel interview');
  }
}

// ============================================
// UTILITIES
// ============================================

export function formatTime(timeStr: string): string {
  // Convert 24h format to 12h format
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

export function formatDateTime(isoString: string, timezone?: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    timeZone: timezone || 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDateOnly(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
