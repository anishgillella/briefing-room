-- ============================================
-- PLUTO DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. JOB POSTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS job_postings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    company_context TEXT,
    
    -- Scoring configuration
    scoring_criteria JSONB DEFAULT '{}',
    red_flag_indicators JSONB DEFAULT '[]',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for listing jobs
CREATE INDEX IF NOT EXISTS idx_job_postings_created ON job_postings(created_at DESC);

-- ============================================
-- 2. CANDIDATES
-- ============================================
CREATE TABLE IF NOT EXISTS candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_posting_id UUID REFERENCES job_postings(id) ON DELETE SET NULL,

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
    
    -- Pipeline Status (auto-updated based on completed interviews)
    pipeline_status TEXT DEFAULT 'new' CHECK (pipeline_status IN (
        'new', 'round_1', 'round_2', 'round_3', 'decision_pending', 'accepted', 'rejected'
    )),
    
    -- Final Decision (set after all 3 stages complete)
    final_decision TEXT CHECK (final_decision IN ('accepted', 'rejected')),
    decision_notes TEXT,
    decided_at TIMESTAMPTZ,
    
    -- Metadata
    source TEXT DEFAULT 'csv_upload',
    has_enrichment_data BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_candidates_job ON candidates(job_posting_id);
CREATE INDEX IF NOT EXISTS idx_candidates_tier ON candidates(tier);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(pipeline_status);
CREATE INDEX IF NOT EXISTS idx_candidates_score ON candidates(combined_score DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_decision ON candidates(final_decision);

-- ============================================
-- 3. PREBRIEFS
-- ============================================
CREATE TABLE IF NOT EXISTS prebriefs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    
    content JSONB NOT NULL,  -- Full prebrief structure
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(candidate_id)  -- One prebrief per candidate
);

-- ============================================
-- 4. INTERVIEWS
-- ============================================

-- Create enum type for interview stages
DO $$ BEGIN
    CREATE TYPE interview_stage AS ENUM ('round_1', 'round_2', 'round_3');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS interviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    
    -- Stage (fixed enum)
    stage interview_stage NOT NULL,
    
    -- Session Info
    interviewer_name TEXT,
    room_name TEXT UNIQUE,  -- LiveKit room ID
    
    -- Status
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
    
    -- Timing
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_sec INT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one interview per stage per candidate
    UNIQUE(candidate_id, stage)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_interviews_candidate ON interviews(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interviews_room ON interviews(room_name);
CREATE INDEX IF NOT EXISTS idx_interviews_status ON interviews(status);
CREATE INDEX IF NOT EXISTS idx_interviews_stage ON interviews(stage);

-- ============================================
-- 5. TRANSCRIPTS
-- ============================================
CREATE TABLE IF NOT EXISTS transcripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    
    -- Structured turns
    turns JSONB NOT NULL DEFAULT '[]',
    
    -- Full text for search
    full_text TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(interview_id)  -- One transcript per interview
);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_transcripts_fulltext ON transcripts USING GIN(to_tsvector('english', COALESCE(full_text, '')));

-- ============================================
-- 6. ANALYTICS
-- ============================================
CREATE TABLE IF NOT EXISTS analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    
    -- Overall Assessment
    overall_score INT CHECK (overall_score BETWEEN 0 AND 100),
    recommendation TEXT CHECK (recommendation IN ('Strong Hire', 'Hire', 'No Hire')),
    synthesis TEXT,
    
    -- Detailed Analysis (JSONB)
    question_analytics JSONB DEFAULT '[]',
    skill_evidence JSONB DEFAULT '[]',
    behavioral_profile JSONB DEFAULT '{}',
    communication_metrics JSONB DEFAULT '{}',
    topics_to_probe JSONB DEFAULT '[]',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(interview_id)  -- One analytics per interview
);

CREATE INDEX IF NOT EXISTS idx_analytics_interview ON analytics(interview_id);
CREATE INDEX IF NOT EXISTS idx_analytics_score ON analytics(overall_score DESC);

-- ============================================
-- 7. QUESTIONS ASKED
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

-- Index for finding questions by interview
CREATE INDEX IF NOT EXISTS idx_questions_interview ON questions_asked(interview_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get next interview stage for a candidate
CREATE OR REPLACE FUNCTION get_next_stage(p_candidate_id UUID)
RETURNS TEXT AS $$
DECLARE
    completed_stages TEXT[];
    stage_order TEXT[] := ARRAY['round_1', 'round_2', 'round_3'];
    next_stage TEXT;
BEGIN
    -- Get completed stages
    SELECT array_agg(stage::TEXT)
    INTO completed_stages
    FROM interviews
    WHERE candidate_id = p_candidate_id
    AND status = 'completed';
    
    -- Find first incomplete stage
    FOREACH next_stage IN ARRAY stage_order
    LOOP
        IF completed_stages IS NULL OR NOT (next_stage = ANY(completed_stages)) THEN
            RETURN next_stage;
        END IF;
    END LOOP;
    
    RETURN NULL;  -- All stages complete
END;
$$ LANGUAGE plpgsql;

-- Function to check if all stages are complete
CREATE OR REPLACE FUNCTION all_stages_complete(p_candidate_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    completed_count INT;
BEGIN
    SELECT COUNT(*)
    INTO completed_count
    FROM interviews
    WHERE candidate_id = p_candidate_id
    AND status = 'completed';
    
    RETURN completed_count >= 3;
END;
$$ LANGUAGE plpgsql;

-- Function to get all questions asked to a candidate
CREATE OR REPLACE FUNCTION get_candidate_questions(p_candidate_id UUID)
RETURNS TABLE (
    question_text TEXT,
    topic TEXT,
    answer_quality INT,
    stage TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        qa.question_text,
        qa.topic,
        qa.answer_quality,
        i.stage::TEXT
    FROM questions_asked qa
    JOIN interviews i ON qa.interview_id = i.id
    WHERE i.candidate_id = p_candidate_id
    ORDER BY i.stage, qa.created_at;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (Optional - enable later)
-- ============================================
-- ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DONE!
-- ============================================
