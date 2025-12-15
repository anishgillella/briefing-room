-- ============================================
-- INTERVIEWER ANALYTICS SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. ADD ROLE COLUMN TO HIRING_MANAGERS
-- ============================================
ALTER TABLE hiring_managers ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'interviewer';
-- Values: 'manager', 'interviewer', 'both'

-- Update Arsene Wenger to be 'both'
UPDATE hiring_managers SET role = 'both' WHERE name = 'Arsene Wenger';

-- ============================================
-- 2. ADD INTERVIEWER_ID TO INTERVIEWS
-- ============================================
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS interviewer_id UUID REFERENCES hiring_managers(id);

-- Index for queries
CREATE INDEX IF NOT EXISTS idx_interviews_interviewer ON interviews(interviewer_id);

-- ============================================
-- 3. CREATE INTERVIEWER_ANALYTICS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS interviewer_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID REFERENCES interviews(id) ON DELETE CASCADE,
    interviewer_id UUID REFERENCES hiring_managers(id),
    
    -- LLM-Generated Scores (0-100)
    question_quality_score INT,
    topic_coverage_score INT,
    consistency_score INT,
    bias_score INT,  -- Lower is better (0 = no bias detected)
    candidate_experience_score INT,
    
    -- Overall
    overall_score INT,
    
    -- Detailed Breakdowns (JSON)
    question_quality_breakdown JSONB,  -- {relevance, depth, follow_up_quality}
    topics_covered JSONB,              -- {technical: 80, behavioral: 60, culture: 40, problem_solving: 70}
    bias_indicators JSONB,             -- {flags: [], severity: "low"}
    
    -- Recommendations
    improvement_suggestions TEXT[],
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_interviewer_analytics_interviewer ON interviewer_analytics(interviewer_id);
CREATE INDEX IF NOT EXISTS idx_interviewer_analytics_interview ON interviewer_analytics(interview_id);

-- ============================================
-- 4. FIX RLS FOR ALL TABLES
-- ============================================

-- Disable RLS on interviewer_analytics
ALTER TABLE interviewer_analytics DISABLE ROW LEVEL SECURITY;

-- Also fix hiring_managers and team_benchmarks (from earlier)
ALTER TABLE hiring_managers DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_benchmarks DISABLE ROW LEVEL SECURITY;

-- Grant permissions to interviewer_analytics
GRANT ALL ON interviewer_analytics TO anon;
GRANT ALL ON interviewer_analytics TO authenticated;
GRANT ALL ON interviewer_analytics TO service_role;

-- Grant permissions to hiring_managers (fix for manager dashboard)
GRANT ALL ON hiring_managers TO anon;
GRANT ALL ON hiring_managers TO authenticated;
GRANT ALL ON hiring_managers TO service_role;

-- Grant permissions to team_benchmarks
GRANT ALL ON team_benchmarks TO anon;
GRANT ALL ON team_benchmarks TO authenticated;
GRANT ALL ON team_benchmarks TO service_role;

-- ============================================
-- DONE!
-- ============================================
