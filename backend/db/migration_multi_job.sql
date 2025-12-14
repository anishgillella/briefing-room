-- ============================================
-- MULTI-JOB APPLICATION SUPPORT
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Add job_posting_id to interviews table
ALTER TABLE interviews 
ADD COLUMN IF NOT EXISTS job_posting_id UUID REFERENCES job_postings(id) ON DELETE SET NULL;

-- 2. Drop old unique constraint (candidate_id, stage)
ALTER TABLE interviews 
DROP CONSTRAINT IF EXISTS interviews_candidate_id_stage_key;

-- 3. Add new unique constraint (candidate_id, job_posting_id, stage)
-- This allows a candidate to interview for different jobs at the same stage
ALTER TABLE interviews 
ADD CONSTRAINT interviews_candidate_job_stage_key 
UNIQUE (candidate_id, job_posting_id, stage);

-- 4. Create index for job-based queries
CREATE INDEX IF NOT EXISTS idx_interviews_job ON interviews(job_posting_id);

-- 5. Add job_posting_id to prebriefs (one prebrief per candidate+job combo)
ALTER TABLE prebriefs 
ADD COLUMN IF NOT EXISTS job_posting_id UUID REFERENCES job_postings(id) ON DELETE SET NULL;

-- Drop old unique constraint
ALTER TABLE prebriefs 
DROP CONSTRAINT IF EXISTS prebriefs_candidate_id_key;

-- Add new unique constraint
ALTER TABLE prebriefs 
ADD CONSTRAINT prebriefs_candidate_job_key 
UNIQUE (candidate_id, job_posting_id);

-- 6. Backfill existing interviews with job_posting_id from their candidate
UPDATE interviews i
SET job_posting_id = c.job_posting_id
FROM candidates c
WHERE i.candidate_id = c.id
AND i.job_posting_id IS NULL;

-- 7. Backfill existing prebriefs with job_posting_id from their candidate
UPDATE prebriefs p
SET job_posting_id = c.job_posting_id
FROM candidates c
WHERE p.candidate_id = c.id
AND p.job_posting_id IS NULL;

-- ============================================
-- Update helper functions for multi-job support
-- ============================================

-- Function to get next interview stage for a candidate+job
CREATE OR REPLACE FUNCTION get_next_stage(p_candidate_id UUID, p_job_posting_id UUID DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
    completed_stages TEXT[];
    stage_order TEXT[] := ARRAY['round_1', 'round_2', 'round_3'];
    next_stage TEXT;
BEGIN
    -- Get completed stages for this candidate+job combo
    SELECT array_agg(stage::TEXT)
    INTO completed_stages
    FROM interviews
    WHERE candidate_id = p_candidate_id
    AND (job_posting_id = p_job_posting_id OR (p_job_posting_id IS NULL AND job_posting_id IS NULL))
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

-- Function to check if all stages are complete for a candidate+job
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
-- DONE!
-- ============================================
