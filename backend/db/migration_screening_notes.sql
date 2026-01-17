-- ============================================
-- SCREENING NOTES MIGRATION
-- Run this in Supabase SQL Editor
--
-- Adds screening_notes column to candidates table
-- for storing LLM screening results (red flags, green flags, etc.)
-- ============================================

-- Add screening_notes column to candidates table
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS screening_notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN candidates.screening_notes IS 'JSON string containing LLM screening results: fit_summary, recommendation, skill_matches, green_flags, red_flags, interview_questions';

-- ============================================
-- DONE!
-- ============================================

-- To verify:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'candidates' AND column_name = 'screening_notes';
