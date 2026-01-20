-- ============================================
-- MIGRATION: Configurable Interview Stages
-- Adds support for custom interview stages per job
-- ============================================

-- Add interview_stages column to job_postings table
-- This stores an array of stage names that can be customized per job
-- Default is ["Round 1", "Round 2", "Round 3"]
ALTER TABLE job_postings
ADD COLUMN IF NOT EXISTS interview_stages JSONB DEFAULT '["Round 1", "Round 2", "Round 3"]'::jsonb;

-- Update existing jobs that have NULL interview_stages to use the default
UPDATE job_postings
SET interview_stages = '["Round 1", "Round 2", "Round 3"]'::jsonb
WHERE interview_stages IS NULL;

-- Comment for documentation
COMMENT ON COLUMN job_postings.interview_stages IS 'Array of interview stage names for this job. Default: ["Round 1", "Round 2", "Round 3"]. Can be customized per job.';

-- ============================================
-- Update candidates table to use dynamic pipeline_status
-- The pipeline_status will now reference stage indices (stage_0, stage_1, etc.)
-- or keep semantic values (new, decision_pending, accepted, rejected)
-- ============================================

-- First, drop the constraint that limits pipeline_status values
ALTER TABLE candidates
DROP CONSTRAINT IF EXISTS candidates_pipeline_status_check;

-- Add new constraint that allows dynamic stage values
-- Format: new, stage_0, stage_1, stage_2, ..., decision_pending, accepted, rejected
ALTER TABLE candidates
ADD CONSTRAINT candidates_pipeline_status_check
CHECK (
    pipeline_status IS NULL
    OR pipeline_status = 'new'
    OR pipeline_status ~ '^stage_[0-9]+$'
    OR pipeline_status IN ('decision_pending', 'accepted', 'rejected')
    -- Keep backward compatibility with old values during transition
    OR pipeline_status IN ('round_1', 'round_2', 'round_3')
);

-- ============================================
-- Create a function to get stage counts for a job
-- ============================================
CREATE OR REPLACE FUNCTION get_job_stage_counts(p_job_id UUID)
RETURNS TABLE (
    stage_index INT,
    stage_name TEXT,
    candidate_count BIGINT
) AS $$
DECLARE
    stages JSONB;
    stage_elem TEXT;
    i INT := 0;
BEGIN
    -- Get the interview stages for this job
    SELECT interview_stages INTO stages
    FROM job_postings
    WHERE id = p_job_id;

    -- If no stages defined, use default
    IF stages IS NULL THEN
        stages := '["Round 1", "Round 2", "Round 3"]'::jsonb;
    END IF;

    -- Return count for each stage
    FOR stage_elem IN SELECT jsonb_array_elements_text(stages)
    LOOP
        stage_index := i;
        stage_name := stage_elem;

        -- Count candidates in this stage
        SELECT COUNT(*) INTO candidate_count
        FROM candidates c
        WHERE c.job_posting_id = p_job_id
        AND (
            c.pipeline_status = 'stage_' || i::TEXT
            -- Also count legacy values during transition
            OR (i = 0 AND c.pipeline_status = 'round_1')
            OR (i = 1 AND c.pipeline_status = 'round_2')
            OR (i = 2 AND c.pipeline_status = 'round_3')
        );

        RETURN NEXT;
        i := i + 1;
    END LOOP;

    RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- DONE!
-- ============================================
