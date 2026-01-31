-- ============================================
-- INTERVIEWER ANALYTICS SCHEMA UPDATE
-- Add granular question-level analytics columns
-- Run this in Supabase SQL Editor
-- ============================================

-- Add new columns for granular analytics data
ALTER TABLE interviewer_analytics 
ADD COLUMN IF NOT EXISTS interview_dynamics JSONB;

ALTER TABLE interviewer_analytics 
ADD COLUMN IF NOT EXISTS question_effectiveness JSONB;

ALTER TABLE interviewer_analytics 
ADD COLUMN IF NOT EXISTS missed_opportunities JSONB;

ALTER TABLE interviewer_analytics 
ADD COLUMN IF NOT EXISTS coverage_gaps TEXT[];

ALTER TABLE interviewer_analytics 
ADD COLUMN IF NOT EXISTS interviewer_strengths TEXT[];

ALTER TABLE interviewer_analytics 
ADD COLUMN IF NOT EXISTS detailed_assessment TEXT;

ALTER TABLE interviewer_analytics 
ADD COLUMN IF NOT EXISTS summary TEXT;

-- ============================================
-- DONE! 
-- New fields will store:
-- - interview_dynamics: time management, listening, rapport, interruptions
-- - question_effectiveness: per-question analysis array
-- - missed_opportunities: topics needing deeper probing
-- - coverage_gaps: critical uncovered areas
-- - interviewer_strengths: what went well
-- - detailed_assessment: narrative summary
-- - summary: one-line summary
-- ============================================
