-- Job Profiles table for Voice Ingest
-- Stores complete job profiles created through the voice onboarding flow

CREATE TABLE IF NOT EXISTS job_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Recruiter info
    recruiter_first_name TEXT NOT NULL,
    recruiter_last_name TEXT NOT NULL,

    -- Company (JSONB for flexibility with CompanyIntelligence model)
    company JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Hard Requirements (JSONB for HardRequirements model)
    requirements JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Candidate Traits (JSONB array of CandidateTrait)
    traits JSONB DEFAULT '[]'::jsonb,

    -- Interview Stages (JSONB array of InterviewStage)
    interview_stages JSONB DEFAULT '[]'::jsonb,

    -- Nuances (JSONB array of NuanceCapture)
    nuances JSONB DEFAULT '[]'::jsonb,

    -- Outreach Config (JSONB for OutreachConfig model)
    outreach JSONB DEFAULT '{}'::jsonb,

    -- Metadata
    extraction_source TEXT DEFAULT 'conversation' CHECK (extraction_source IN ('jd_paste', 'conversation', 'mixed', 'parallel_ai')),
    field_confidence JSONB DEFAULT '[]'::jsonb,

    -- Status
    is_complete BOOLEAN DEFAULT FALSE,
    missing_required_fields TEXT[] DEFAULT '{}',

    -- Research status
    parallel_research_status TEXT DEFAULT 'pending' CHECK (parallel_research_status IN ('pending', 'in_progress', 'complete', 'failed', 'partial'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_job_profiles_created_at ON job_profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_profiles_is_complete ON job_profiles(is_complete);
CREATE INDEX IF NOT EXISTS idx_job_profiles_recruiter ON job_profiles(recruiter_first_name, recruiter_last_name);
CREATE INDEX IF NOT EXISTS idx_job_profiles_company_name ON job_profiles((company->>'name'));

-- Index for incomplete profiles (partial index for efficiency)
CREATE INDEX IF NOT EXISTS idx_job_profiles_incomplete ON job_profiles(created_at DESC) WHERE is_complete = FALSE;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_job_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS job_profiles_updated_at ON job_profiles;
CREATE TRIGGER job_profiles_updated_at
    BEFORE UPDATE ON job_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_job_profiles_updated_at();

-- Enable Row Level Security
ALTER TABLE job_profiles ENABLE ROW LEVEL SECURITY;

-- Policy to allow all operations (adjust based on auth requirements)
DROP POLICY IF EXISTS "Enable all operations for job_profiles" ON job_profiles;
CREATE POLICY "Enable all operations for job_profiles" ON job_profiles
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Comments for documentation
COMMENT ON TABLE job_profiles IS 'Job profiles created through voice ingest onboarding flow';
COMMENT ON COLUMN job_profiles.company IS 'CompanyIntelligence model as JSONB - includes Parallel.ai research';
COMMENT ON COLUMN job_profiles.requirements IS 'HardRequirements model as JSONB - location, compensation, experience, visa';
COMMENT ON COLUMN job_profiles.traits IS 'Array of CandidateTrait models as JSONB';
COMMENT ON COLUMN job_profiles.interview_stages IS 'Array of InterviewStage models as JSONB';
COMMENT ON COLUMN job_profiles.nuances IS 'Array of NuanceCapture models as JSONB - qualitative insights';
COMMENT ON COLUMN job_profiles.outreach IS 'OutreachConfig model as JSONB - email template and preferences';
COMMENT ON COLUMN job_profiles.field_confidence IS 'Array of FieldConfidence for tracking extraction certainty';
COMMENT ON COLUMN job_profiles.parallel_research_status IS 'Status of Parallel.ai company research';


-- Optional: Job Traits table for normalized storage (can be used alongside JSONB)
-- Useful if you want to query traits across jobs

CREATE TABLE IF NOT EXISTS job_traits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_profile_id UUID NOT NULL REFERENCES job_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('must_have', 'nice_to_have')),
    signals JSONB DEFAULT '[]'::jsonb,
    anti_signals JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_traits_job_profile ON job_traits(job_profile_id);
CREATE INDEX IF NOT EXISTS idx_job_traits_priority ON job_traits(priority);

COMMENT ON TABLE job_traits IS 'Normalized storage for job traits - optional, can use JSONB in job_profiles instead';


-- Optional: Job Interview Stages table for normalized storage

CREATE TABLE IF NOT EXISTS job_interview_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_profile_id UUID NOT NULL REFERENCES job_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    stage_order INT NOT NULL,
    duration_minutes INT,
    interviewer_role TEXT,
    actions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_interview_stages_job_profile ON job_interview_stages(job_profile_id);
CREATE INDEX IF NOT EXISTS idx_job_interview_stages_order ON job_interview_stages(job_profile_id, stage_order);

COMMENT ON TABLE job_interview_stages IS 'Normalized storage for interview stages - optional, can use JSONB in job_profiles instead';
