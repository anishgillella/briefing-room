-- ============================================
-- STREAMLINED INTERVIEW FLOW MIGRATION
-- Run this in Supabase SQL Editor
--
-- This migration adds the Person table and updates
-- the existing schema to support the unified flow.
-- ============================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PERSONS TABLE (NEW)
-- Represents unique individuals who can apply to multiple jobs
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

-- Index for email lookups (deduplication)
CREATE INDEX IF NOT EXISTS idx_persons_email ON persons(email);

-- ============================================
-- 2. UPDATE JOBS TABLE (was job_postings)
-- Add new fields for the streamlined flow
-- ============================================

-- Add status column
ALTER TABLE job_postings
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft'
CHECK (status IN ('draft', 'active', 'paused', 'closed'));

-- Add extracted requirements (from JD parsing)
ALTER TABLE job_postings
ADD COLUMN IF NOT EXISTS extracted_requirements JSONB DEFAULT '{}';

-- Rename company_context to richer structure
-- (keeping the old column, adding new structure)
ALTER TABLE job_postings
ADD COLUMN IF NOT EXISTS company_context_enriched JSONB DEFAULT '{}';

-- Add red_flags array
ALTER TABLE job_postings
ADD COLUMN IF NOT EXISTS red_flags JSONB DEFAULT '[]';

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_job_postings_status ON job_postings(status);

-- ============================================
-- 3. UPDATE CANDIDATES TABLE
-- Add person_id for the Person-Candidate relationship
-- ============================================

-- Add person_id column (nullable for backward compatibility)
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES persons(id) ON DELETE SET NULL;

-- Create index for person lookups
CREATE INDEX IF NOT EXISTS idx_candidates_person ON candidates(person_id);

-- Update constraint to allow same person to apply to multiple jobs
-- The unique constraint should be (person_id, job_posting_id)
-- First, let's add this as a new constraint (doesn't affect existing data)
DO $$
BEGIN
    -- Only add if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'candidates_person_job_unique'
    ) THEN
        ALTER TABLE candidates
        ADD CONSTRAINT candidates_person_job_unique
        UNIQUE (person_id, job_posting_id);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 4. UPDATE INTERVIEWS TABLE
-- Add fields for streamlined flow
-- ============================================

-- Add interview_type column
ALTER TABLE interviews
ADD COLUMN IF NOT EXISTS interview_type VARCHAR(20) DEFAULT 'ai_candidate'
CHECK (interview_type IN ('ai_candidate', 'live', 'phone_screen'));

-- Add transcript column (store full transcript in DB)
ALTER TABLE interviews
ADD COLUMN IF NOT EXISTS transcript TEXT;

-- Add notes column
ALTER TABLE interviews
ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================
-- 5. UPDATE ANALYTICS TABLE
-- Add fields for job-specific scoring
-- ============================================

-- Add new analytics fields
ALTER TABLE analytics
ADD COLUMN IF NOT EXISTS competency_scores JSONB DEFAULT '[]';

ALTER TABLE analytics
ADD COLUMN IF NOT EXISTS strengths JSONB DEFAULT '[]';

ALTER TABLE analytics
ADD COLUMN IF NOT EXISTS concerns JSONB DEFAULT '[]';

ALTER TABLE analytics
ADD COLUMN IF NOT EXISTS red_flags_detected JSONB DEFAULT '[]';

ALTER TABLE analytics
ADD COLUMN IF NOT EXISTS must_have_assessments JSONB DEFAULT '[]';

ALTER TABLE analytics
ADD COLUMN IF NOT EXISTS recommendation_reasoning TEXT;

ALTER TABLE analytics
ADD COLUMN IF NOT EXISTS summary TEXT;

ALTER TABLE analytics
ADD COLUMN IF NOT EXISTS raw_ai_response JSONB;

ALTER TABLE analytics
ADD COLUMN IF NOT EXISTS model_used VARCHAR(100);

-- Update recommendation check to include new values
ALTER TABLE analytics
DROP CONSTRAINT IF EXISTS analytics_recommendation_check;

ALTER TABLE analytics
ADD CONSTRAINT analytics_recommendation_check
CHECK (recommendation IN ('Strong Hire', 'Hire', 'Leaning Hire', 'Leaning No Hire', 'No Hire', 'strong_hire', 'hire', 'maybe', 'no_hire'));

-- ============================================
-- 6. HELPER VIEWS
-- ============================================

-- View: Candidates with full context (person + job)
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

-- View: Job dashboard summary
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
-- 7. UPDATED_AT TRIGGER
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to persons table
DROP TRIGGER IF EXISTS update_persons_updated_at ON persons;
CREATE TRIGGER update_persons_updated_at
    BEFORE UPDATE ON persons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to job_postings table
DROP TRIGGER IF EXISTS update_job_postings_updated_at ON job_postings;
CREATE TRIGGER update_job_postings_updated_at
    BEFORE UPDATE ON job_postings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to candidates table
DROP TRIGGER IF EXISTS update_candidates_updated_at ON candidates;
CREATE TRIGGER update_candidates_updated_at
    BEFORE UPDATE ON candidates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. MIGRATION HELPER: POPULATE PERSONS
-- This migrates existing candidates to have Person records
-- ============================================

-- Create persons from existing candidates (one per unique email)
INSERT INTO persons (name, email, linkedin_url, created_at)
SELECT DISTINCT ON (email)
    name,
    email,
    linkedin_url,
    created_at
FROM candidates
WHERE email IS NOT NULL
  AND email != ''
  AND person_id IS NULL
ON CONFLICT (email) DO NOTHING;

-- Link candidates to their person records
UPDATE candidates c
SET person_id = p.id
FROM persons p
WHERE c.email = p.email
  AND c.person_id IS NULL;

-- ============================================
-- DONE!
-- ============================================

-- To verify the migration:
-- SELECT COUNT(*) FROM persons;
-- SELECT COUNT(*) FROM candidates WHERE person_id IS NOT NULL;
-- SELECT * FROM job_dashboard_view;
