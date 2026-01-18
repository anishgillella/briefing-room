-- ============================================
-- MIGRATION: Interview Scheduling Feature
-- ============================================
-- Adds support for:
-- - Scheduling interviews in advance
-- - Interviewer availability management (weekly + specific dates)
-- - Timezone support per interviewer
-- ============================================

-- ============================================
-- 1. ADD SCHEDULING FIELDS TO INTERVIEWS TABLE
-- ============================================

-- Add scheduled_at for planned interview time
ALTER TABLE interviews
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- Add expected duration in minutes (default 45 min)
ALTER TABLE interviews
ADD COLUMN IF NOT EXISTS duration_minutes INT DEFAULT 45;

-- Add meeting link (for external calendar integration or manual links)
ALTER TABLE interviews
ADD COLUMN IF NOT EXISTS meeting_link TEXT;

-- Add timezone for the scheduled interview
ALTER TABLE interviews
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';

-- Add cancellation reason
ALTER TABLE interviews
ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- Add reminder tracking
ALTER TABLE interviews
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- Add rescheduled_from to track rescheduling history
ALTER TABLE interviews
ADD COLUMN IF NOT EXISTS rescheduled_from UUID REFERENCES interviews(id);

-- Index for finding upcoming scheduled interviews
CREATE INDEX IF NOT EXISTS idx_interviews_scheduled_at ON interviews(scheduled_at)
WHERE scheduled_at IS NOT NULL AND status = 'scheduled';

-- ============================================
-- 2. ADD TIMEZONE TO HIRING MANAGERS
-- ============================================

-- Add timezone preference for each interviewer
ALTER TABLE hiring_managers
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';

-- Add default interview duration preference
ALTER TABLE hiring_managers
ADD COLUMN IF NOT EXISTS default_interview_duration_minutes INT DEFAULT 45;

-- Add max interviews per day limit
ALTER TABLE hiring_managers
ADD COLUMN IF NOT EXISTS max_interviews_per_day INT DEFAULT 5;

-- ============================================
-- 3. AVAILABILITY SLOTS TABLE (Weekly Recurring)
-- ============================================
-- Stores recurring weekly availability for interviewers
-- e.g., "Available every Monday 9am-12pm and 2pm-5pm"

CREATE TABLE IF NOT EXISTS availability_weekly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interviewer_id UUID NOT NULL REFERENCES hiring_managers(id) ON DELETE CASCADE,

    -- Day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),

    -- Time slots in interviewer's timezone
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,

    -- Is this slot active?
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure start_time < end_time
    CONSTRAINT availability_weekly_time_check CHECK (start_time < end_time),

    -- Unique slot per interviewer per day per time
    CONSTRAINT availability_weekly_unique UNIQUE (interviewer_id, day_of_week, start_time, end_time)
);

CREATE INDEX IF NOT EXISTS idx_availability_weekly_interviewer ON availability_weekly(interviewer_id);
CREATE INDEX IF NOT EXISTS idx_availability_weekly_day ON availability_weekly(day_of_week);
CREATE INDEX IF NOT EXISTS idx_availability_weekly_active ON availability_weekly(is_active) WHERE is_active = TRUE;

-- ============================================
-- 4. AVAILABILITY OVERRIDES TABLE (Specific Dates)
-- ============================================
-- Stores specific date overrides (both availability and unavailability)
-- e.g., "Available Jan 20th 10am-2pm" or "Unavailable Jan 25th (vacation)"

CREATE TABLE IF NOT EXISTS availability_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interviewer_id UUID NOT NULL REFERENCES hiring_managers(id) ON DELETE CASCADE,

    -- Specific date
    override_date DATE NOT NULL,

    -- Override type: 'available' adds availability, 'unavailable' blocks time
    override_type TEXT NOT NULL CHECK (override_type IN ('available', 'unavailable')),

    -- Time slots (NULL for all-day unavailability)
    start_time TIME,
    end_time TIME,

    -- Reason for override (e.g., "Vacation", "Conference", "Extra availability")
    reason TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- If times are provided, ensure start < end
    CONSTRAINT availability_overrides_time_check CHECK (
        (start_time IS NULL AND end_time IS NULL) OR
        (start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)
    )
);

CREATE INDEX IF NOT EXISTS idx_availability_overrides_interviewer ON availability_overrides(interviewer_id);
CREATE INDEX IF NOT EXISTS idx_availability_overrides_date ON availability_overrides(override_date);
CREATE INDEX IF NOT EXISTS idx_availability_overrides_type ON availability_overrides(override_type);

-- ============================================
-- 5. SCHEDULED INTERVIEWS VIEW
-- ============================================
-- Convenient view for upcoming scheduled interviews

CREATE OR REPLACE VIEW upcoming_interviews AS
SELECT
    i.id,
    i.candidate_id,
    i.job_posting_id,
    i.interviewer_id,
    i.stage,
    i.interview_type,
    i.scheduled_at,
    i.duration_minutes,
    i.timezone,
    i.meeting_link,
    i.room_name,
    i.status,
    c.person_id,
    p.name AS candidate_name,
    p.email AS candidate_email,
    hm.name AS interviewer_name,
    hm.email AS interviewer_email,
    jp.title AS job_title
FROM interviews i
LEFT JOIN candidates c ON i.candidate_id = c.id
LEFT JOIN persons p ON c.person_id = p.id
LEFT JOIN hiring_managers hm ON i.interviewer_id = hm.id
LEFT JOIN job_postings jp ON i.job_posting_id = jp.id
WHERE i.scheduled_at IS NOT NULL
  AND i.status = 'scheduled'
  AND i.scheduled_at >= NOW()
ORDER BY i.scheduled_at ASC;

-- ============================================
-- 6. DISABLE RLS FOR NEW TABLES
-- ============================================

ALTER TABLE availability_weekly DISABLE ROW LEVEL SECURITY;
ALTER TABLE availability_overrides DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. GRANT PERMISSIONS
-- ============================================

GRANT ALL ON availability_weekly TO postgres, anon, authenticated, service_role;
GRANT ALL ON availability_overrides TO postgres, anon, authenticated, service_role;
GRANT ALL ON upcoming_interviews TO postgres, anon, authenticated, service_role;

-- ============================================
-- DONE!
-- ============================================
