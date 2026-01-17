-- ============================================
-- BRIEFING ROOM - COMPLETE DATABASE SCHEMA
-- Run this in Supabase SQL Editor for fresh setup
--
-- This consolidated migration includes ALL tables
-- and should be run on a fresh database.
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. RECRUITERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS recruiters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recruiters_email ON recruiters(email);

-- ============================================
-- 2. JOB POSTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS job_postings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recruiter_id UUID REFERENCES recruiters(id) ON DELETE SET NULL,

    title TEXT NOT NULL,
    description TEXT NOT NULL,
    company_context TEXT,

    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'closed')),

    -- Scoring configuration
    scoring_criteria JSONB DEFAULT '{}',
    red_flag_indicators JSONB DEFAULT '[]',
    extracted_requirements JSONB DEFAULT '{}',
    company_context_enriched JSONB DEFAULT '{}',
    red_flags JSONB DEFAULT '[]',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_postings_created ON job_postings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_postings_status ON job_postings(status);
CREATE INDEX IF NOT EXISTS idx_job_postings_recruiter_id ON job_postings(recruiter_id);

-- ============================================
-- 3. PERSONS TABLE (for deduplication)
-- ============================================
CREATE TABLE IF NOT EXISTS persons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    resume_url TEXT,
    linkedin_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_persons_email ON persons(email);

-- ============================================
-- 4. CANDIDATES
-- ============================================
CREATE TABLE IF NOT EXISTS candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_posting_id UUID REFERENCES job_postings(id) ON DELETE SET NULL,
    person_id UUID REFERENCES persons(id) ON DELETE SET NULL,

    -- JSON ID (for bridging Pluto JSON storage to database)
    json_id TEXT UNIQUE,

    -- Basic Info
    name TEXT NOT NULL,
    email TEXT,
    linkedin_url TEXT,
    job_title TEXT,
    current_company TEXT,
    location_city TEXT,
    location_state TEXT,

    -- Professional Background
    years_experience FLOAT,
    bio_summary TEXT,
    skills JSONB DEFAULT '[]',
    industries JSONB DEFAULT '[]',
    education JSONB DEFAULT '[]',

    -- Scoring
    algo_score INT CHECK (algo_score BETWEEN 0 AND 100),
    ai_score INT CHECK (ai_score BETWEEN 0 AND 100),
    combined_score INT CHECK (combined_score BETWEEN 0 AND 100),
    tier TEXT CHECK (tier IN ('Top Tier', 'Strong', 'Good', 'Evaluate', 'Poor')),

    -- AI Analysis
    one_line_summary TEXT,
    pros JSONB DEFAULT '[]',
    cons JSONB DEFAULT '[]',
    reasoning TEXT,
    interview_questions JSONB DEFAULT '[]',

    -- Pipeline Status
    pipeline_status TEXT DEFAULT 'new' CHECK (pipeline_status IN (
        'new', 'round_1', 'round_2', 'round_3', 'decision_pending', 'accepted', 'rejected'
    )),

    -- Final Decision
    final_decision TEXT CHECK (final_decision IN ('accepted', 'rejected')),
    decision_notes TEXT,
    decided_at TIMESTAMPTZ,

    -- Metadata
    source TEXT DEFAULT 'csv_upload',
    has_enrichment_data BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT candidates_person_job_unique UNIQUE (person_id, job_posting_id)
);

CREATE INDEX IF NOT EXISTS idx_candidates_job ON candidates(job_posting_id);
CREATE INDEX IF NOT EXISTS idx_candidates_person ON candidates(person_id);
CREATE INDEX IF NOT EXISTS idx_candidates_tier ON candidates(tier);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(pipeline_status);
CREATE INDEX IF NOT EXISTS idx_candidates_score ON candidates(combined_score DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_decision ON candidates(final_decision);

-- ============================================
-- 5. HIRING MANAGERS / INTERVIEWERS
-- ============================================
CREATE TABLE IF NOT EXISTS hiring_managers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name TEXT NOT NULL,
    email TEXT,
    department TEXT,
    team TEXT,
    role TEXT DEFAULT 'interviewer', -- 'manager', 'interviewer', 'both'

    -- Cached Metrics
    total_candidates_reviewed INT DEFAULT 0,
    total_interviews_conducted INT DEFAULT 0,
    total_offers_made INT DEFAULT 0,
    total_hires INT DEFAULT 0,

    -- Rates
    interview_to_offer_rate FLOAT,
    offer_to_hire_rate FLOAT,

    -- Timing
    avg_time_to_first_interview_days FLOAT,
    avg_time_in_pipeline_days FLOAT,
    avg_interviews_per_candidate FLOAT,

    -- Quality
    avg_hire_performance_score FLOAT,
    hire_retention_rate FLOAT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hiring_managers_team ON hiring_managers(team);
CREATE INDEX IF NOT EXISTS idx_hiring_managers_department ON hiring_managers(department);

-- ============================================
-- 6. TEAM BENCHMARKS
-- ============================================
CREATE TABLE IF NOT EXISTS team_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    team TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    avg_interview_rate FLOAT,
    avg_offer_rate FLOAT,
    avg_hire_rate FLOAT,
    avg_time_to_first_interview FLOAT,
    avg_time_in_pipeline FLOAT,
    avg_interviews_per_candidate FLOAT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_benchmarks_team ON team_benchmarks(team);
CREATE INDEX IF NOT EXISTS idx_team_benchmarks_period ON team_benchmarks(period_start, period_end);

-- ============================================
-- 7. PREBRIEFS
-- ============================================
CREATE TABLE IF NOT EXISTS prebriefs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    job_posting_id UUID REFERENCES job_postings(id) ON DELETE SET NULL,

    content JSONB NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT prebriefs_candidate_job_key UNIQUE (candidate_id, job_posting_id)
);

-- ============================================
-- 8. INTERVIEWS
-- ============================================
DO $$ BEGIN
    CREATE TYPE interview_stage AS ENUM ('round_1', 'round_2', 'round_3');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS interviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    job_posting_id UUID REFERENCES job_postings(id) ON DELETE SET NULL,
    hiring_manager_id UUID REFERENCES hiring_managers(id),
    interviewer_id UUID REFERENCES hiring_managers(id),

    stage interview_stage NOT NULL,
    interview_type VARCHAR(20) DEFAULT 'ai_candidate' CHECK (interview_type IN ('ai_candidate', 'live', 'phone_screen')),

    interviewer_name TEXT,
    room_name TEXT UNIQUE,

    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),

    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_sec INT,

    transcript TEXT,
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT interviews_candidate_job_stage_key UNIQUE (candidate_id, job_posting_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_interviews_candidate ON interviews(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interviews_job ON interviews(job_posting_id);
CREATE INDEX IF NOT EXISTS idx_interviews_room ON interviews(room_name);
CREATE INDEX IF NOT EXISTS idx_interviews_status ON interviews(status);
CREATE INDEX IF NOT EXISTS idx_interviews_stage ON interviews(stage);
CREATE INDEX IF NOT EXISTS idx_interviews_manager ON interviews(hiring_manager_id);
CREATE INDEX IF NOT EXISTS idx_interviews_interviewer ON interviews(interviewer_id);

-- ============================================
-- 9. TRANSCRIPTS
-- ============================================
CREATE TABLE IF NOT EXISTS transcripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,

    turns JSONB NOT NULL DEFAULT '[]',
    full_text TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(interview_id)
);

CREATE INDEX IF NOT EXISTS idx_transcripts_fulltext ON transcripts USING GIN(to_tsvector('english', COALESCE(full_text, '')));

-- ============================================
-- 10. ANALYTICS
-- ============================================
CREATE TABLE IF NOT EXISTS analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,

    overall_score INT CHECK (overall_score BETWEEN 0 AND 100),
    recommendation TEXT CHECK (recommendation IN ('Strong Hire', 'Hire', 'Leaning Hire', 'Leaning No Hire', 'No Hire', 'strong_hire', 'hire', 'maybe', 'no_hire')),
    synthesis TEXT,

    question_analytics JSONB DEFAULT '[]',
    skill_evidence JSONB DEFAULT '[]',
    behavioral_profile JSONB DEFAULT '{}',
    communication_metrics JSONB DEFAULT '{}',
    topics_to_probe JSONB DEFAULT '[]',

    -- Extended analytics fields
    competency_scores JSONB DEFAULT '[]',
    strengths JSONB DEFAULT '[]',
    concerns JSONB DEFAULT '[]',
    red_flags_detected JSONB DEFAULT '[]',
    must_have_assessments JSONB DEFAULT '[]',
    recommendation_reasoning TEXT,
    summary TEXT,
    raw_ai_response JSONB,
    model_used VARCHAR(100),

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(interview_id)
);

CREATE INDEX IF NOT EXISTS idx_analytics_interview ON analytics(interview_id);
CREATE INDEX IF NOT EXISTS idx_analytics_score ON analytics(overall_score DESC);

-- ============================================
-- 11. INTERVIEWER ANALYTICS
-- ============================================
CREATE TABLE IF NOT EXISTS interviewer_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID REFERENCES interviews(id) ON DELETE CASCADE,
    interviewer_id UUID REFERENCES hiring_managers(id),

    question_quality_score INT,
    topic_coverage_score INT,
    consistency_score INT,
    bias_score INT,
    candidate_experience_score INT,
    overall_score INT,

    question_quality_breakdown JSONB,
    topics_covered JSONB,
    bias_indicators JSONB,
    improvement_suggestions TEXT[],

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interviewer_analytics_interviewer ON interviewer_analytics(interviewer_id);
CREATE INDEX IF NOT EXISTS idx_interviewer_analytics_interview ON interviewer_analytics(interview_id);

-- ============================================
-- 12. QUESTIONS ASKED
-- ============================================
CREATE TABLE IF NOT EXISTS questions_asked (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,

    question_text TEXT NOT NULL,
    topic TEXT,
    answer_quality INT CHECK (answer_quality BETWEEN 0 AND 10),
    follow_up_needed BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_interview ON questions_asked(interview_id);

-- ============================================
-- 13. ROOMS (LiveKit)
-- ============================================
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    daily_room_url TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rooms_name ON rooms(name);
CREATE INDEX IF NOT EXISTS idx_rooms_expires_at ON rooms(expires_at);

-- ============================================
-- 14. JOB PROFILES (Voice Ingest)
-- ============================================
CREATE TABLE IF NOT EXISTS job_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    recruiter_first_name TEXT NOT NULL,
    recruiter_last_name TEXT NOT NULL,
    company JSONB NOT NULL DEFAULT '{}'::jsonb,
    requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
    traits JSONB DEFAULT '[]'::jsonb,
    interview_stages JSONB DEFAULT '[]'::jsonb,
    nuances JSONB DEFAULT '[]'::jsonb,
    outreach JSONB DEFAULT '{}'::jsonb,
    extraction_source TEXT DEFAULT 'conversation' CHECK (extraction_source IN ('jd_paste', 'conversation', 'mixed', 'parallel_ai')),
    field_confidence JSONB DEFAULT '[]'::jsonb,
    is_complete BOOLEAN DEFAULT FALSE,
    missing_required_fields TEXT[] DEFAULT '{}',
    parallel_research_status TEXT DEFAULT 'pending' CHECK (parallel_research_status IN ('pending', 'in_progress', 'complete', 'failed', 'partial'))
);

CREATE INDEX IF NOT EXISTS idx_job_profiles_created_at ON job_profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_profiles_is_complete ON job_profiles(is_complete);
CREATE INDEX IF NOT EXISTS idx_job_profiles_recruiter ON job_profiles(recruiter_first_name, recruiter_last_name);
CREATE INDEX IF NOT EXISTS idx_job_profiles_incomplete ON job_profiles(created_at DESC) WHERE is_complete = FALSE;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_recruiters_updated_at ON recruiters;
CREATE TRIGGER update_recruiters_updated_at BEFORE UPDATE ON recruiters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_job_postings_updated_at ON job_postings;
CREATE TRIGGER update_job_postings_updated_at BEFORE UPDATE ON job_postings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_persons_updated_at ON persons;
CREATE TRIGGER update_persons_updated_at BEFORE UPDATE ON persons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_candidates_updated_at ON candidates;
CREATE TRIGGER update_candidates_updated_at BEFORE UPDATE ON candidates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hiring_managers_updated_at ON hiring_managers;
CREATE TRIGGER update_hiring_managers_updated_at BEFORE UPDATE ON hiring_managers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS job_profiles_updated_at ON job_profiles;
CREATE TRIGGER job_profiles_updated_at BEFORE UPDATE ON job_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get next interview stage
CREATE OR REPLACE FUNCTION get_next_stage(p_candidate_id UUID, p_job_posting_id UUID DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
    completed_stages TEXT[];
    stage_order TEXT[] := ARRAY['round_1', 'round_2', 'round_3'];
    next_stage TEXT;
BEGIN
    SELECT array_agg(stage::TEXT)
    INTO completed_stages
    FROM interviews
    WHERE candidate_id = p_candidate_id
    AND (job_posting_id = p_job_posting_id OR (p_job_posting_id IS NULL AND job_posting_id IS NULL))
    AND status = 'completed';

    FOREACH next_stage IN ARRAY stage_order
    LOOP
        IF completed_stages IS NULL OR NOT (next_stage = ANY(completed_stages)) THEN
            RETURN next_stage;
        END IF;
    END LOOP;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to check if all stages complete
CREATE OR REPLACE FUNCTION all_stages_complete(p_candidate_id UUID, p_job_posting_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    completed_count INT;
BEGIN
    SELECT COUNT(*)
    INTO completed_count
    FROM interviews
    WHERE candidate_id = p_candidate_id
    AND (job_posting_id = p_job_posting_id OR (p_job_posting_id IS NULL AND job_posting_id IS NULL))
    AND status = 'completed';

    RETURN completed_count >= 3;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEWS
-- ============================================

CREATE OR REPLACE VIEW candidate_full_view AS
SELECT
    c.id,
    c.person_id,
    c.job_posting_id AS job_id,
    p.name AS person_name,
    p.email AS person_email,
    p.phone AS person_phone,
    p.linkedin_url AS person_linkedin,
    j.title AS job_title,
    j.status AS job_status,
    c.bio_summary,
    c.skills,
    c.years_experience,
    c.current_company,
    c.job_title AS current_title,
    c.tier,
    c.combined_score,
    c.pipeline_status AS interview_status,
    c.created_at,
    c.updated_at,
    (SELECT COUNT(*) FROM interviews i WHERE i.candidate_id = c.id AND i.status = 'completed') AS interview_count,
    (SELECT a.overall_score
     FROM analytics a
     JOIN interviews i ON a.interview_id = i.id
     WHERE i.candidate_id = c.id
     ORDER BY a.created_at DESC
     LIMIT 1) AS latest_score
FROM candidates c
LEFT JOIN persons p ON c.person_id = p.id
LEFT JOIN job_postings j ON c.job_posting_id = j.id;

CREATE OR REPLACE VIEW job_dashboard_view AS
SELECT
    j.id,
    j.title,
    j.status,
    j.created_at,
    j.updated_at,
    COUNT(DISTINCT c.id) AS candidate_count,
    COUNT(DISTINCT CASE WHEN c.pipeline_status IN ('round_1', 'round_2', 'round_3', 'decision_pending') THEN c.id END) AS in_progress_count,
    COUNT(DISTINCT CASE WHEN i.status = 'completed' THEN c.id END) AS interviewed_count,
    COUNT(DISTINCT CASE WHEN c.pipeline_status = 'new' THEN c.id END) AS pending_count,
    AVG(a.overall_score) AS avg_score
FROM job_postings j
LEFT JOIN candidates c ON j.id = c.job_posting_id
LEFT JOIN interviews i ON c.id = i.candidate_id
LEFT JOIN analytics a ON i.id = a.interview_id
GROUP BY j.id, j.title, j.status, j.created_at, j.updated_at;

-- ============================================
-- ROW LEVEL SECURITY - DISABLED FOR DEV
-- ============================================

ALTER TABLE recruiters DISABLE ROW LEVEL SECURITY;
ALTER TABLE job_postings DISABLE ROW LEVEL SECURITY;
ALTER TABLE persons DISABLE ROW LEVEL SECURITY;
ALTER TABLE candidates DISABLE ROW LEVEL SECURITY;
ALTER TABLE hiring_managers DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_benchmarks DISABLE ROW LEVEL SECURITY;
ALTER TABLE prebriefs DISABLE ROW LEVEL SECURITY;
ALTER TABLE interviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts DISABLE ROW LEVEL SECURITY;
ALTER TABLE analytics DISABLE ROW LEVEL SECURITY;
ALTER TABLE interviewer_analytics DISABLE ROW LEVEL SECURITY;
ALTER TABLE questions_asked DISABLE ROW LEVEL SECURITY;
ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE job_profiles DISABLE ROW LEVEL SECURITY;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

GRANT ALL ON recruiters TO postgres, anon, authenticated, service_role;
GRANT ALL ON job_postings TO postgres, anon, authenticated, service_role;
GRANT ALL ON persons TO postgres, anon, authenticated, service_role;
GRANT ALL ON candidates TO postgres, anon, authenticated, service_role;
GRANT ALL ON hiring_managers TO postgres, anon, authenticated, service_role;
GRANT ALL ON team_benchmarks TO postgres, anon, authenticated, service_role;
GRANT ALL ON prebriefs TO postgres, anon, authenticated, service_role;
GRANT ALL ON interviews TO postgres, anon, authenticated, service_role;
GRANT ALL ON transcripts TO postgres, anon, authenticated, service_role;
GRANT ALL ON analytics TO postgres, anon, authenticated, service_role;
GRANT ALL ON interviewer_analytics TO postgres, anon, authenticated, service_role;
GRANT ALL ON questions_asked TO postgres, anon, authenticated, service_role;
GRANT ALL ON rooms TO postgres, anon, authenticated, service_role;
GRANT ALL ON job_profiles TO postgres, anon, authenticated, service_role;

-- ============================================
-- SEED DATA (Optional)
-- ============================================

-- Seed hiring managers
INSERT INTO hiring_managers (name, email, department, team, role) VALUES
    ('Arsene Wenger', 'arsene.wenger@company.com', 'Engineering', 'Platform', 'both'),
    ('Sarah Chen', 'sarah.chen@company.com', 'Engineering', 'Platform', 'interviewer'),
    ('Michael Rodriguez', 'michael.r@company.com', 'Engineering', 'Infrastructure', 'interviewer'),
    ('Emily Watson', 'emily.w@company.com', 'Product', 'Growth', 'manager'),
    ('James Park', 'james.p@company.com', 'Sales', 'Enterprise', 'manager')
ON CONFLICT DO NOTHING;

-- Seed team benchmarks
INSERT INTO team_benchmarks (team, period_start, period_end, avg_interview_rate, avg_offer_rate, avg_hire_rate, avg_time_to_first_interview, avg_time_in_pipeline, avg_interviews_per_candidate) VALUES
    ('Platform', '2024-01-01', '2024-12-31', 0.50, 0.08, 0.75, 4.0, 21.0, 3.2),
    ('Infrastructure', '2024-01-01', '2024-12-31', 0.45, 0.10, 0.70, 5.0, 25.0, 3.5),
    ('Growth', '2024-01-01', '2024-12-31', 0.55, 0.12, 0.80, 3.0, 18.0, 2.8),
    ('Enterprise', '2024-01-01', '2024-12-31', 0.40, 0.15, 0.85, 6.0, 30.0, 4.0)
ON CONFLICT DO NOTHING;

-- ============================================
-- DONE!
-- ============================================
