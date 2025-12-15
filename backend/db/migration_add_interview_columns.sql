-- ============================================
-- MIGRATION: Add Missing Columns for Interview Analytics
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Add missing columns to CANDIDATES table
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS interview_status TEXT DEFAULT 'not_scheduled';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS interview_score INT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS recommendation TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS room_name TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS completeness INT DEFAULT 0;

-- 2. Add missing columns to INTERVIEWS table
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS interviewer_id UUID;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS hiring_manager_id UUID;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS score INT;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS job_posting_id UUID;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_candidates_interview_status ON candidates(interview_status);
CREATE INDEX IF NOT EXISTS idx_candidates_interview_score ON candidates(interview_score);
CREATE INDEX IF NOT EXISTS idx_interviews_interviewer ON interviews(interviewer_id);
CREATE INDEX IF NOT EXISTS idx_interviews_manager ON interviews(hiring_manager_id);
CREATE INDEX IF NOT EXISTS idx_interviews_job_posting ON interviews(job_posting_id);

-- 4. Add Foreign Key Constraints (Safe Block)
-- This ensures that querying interviews with joined candidates/managers works correctly
DO $$ 
BEGIN 
    -- Candidate FK
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_interviews_candidate') THEN
        ALTER TABLE interviews ADD CONSTRAINT fk_interviews_candidate FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE;
    END IF;

    -- Hiring Manager FK
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_interviews_manager') THEN
        ALTER TABLE interviews ADD CONSTRAINT fk_interviews_manager FOREIGN KEY (hiring_manager_id) REFERENCES hiring_managers(id) ON DELETE SET NULL;
    END IF;

    -- Interviewer FK
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_interviews_interviewer') THEN
        ALTER TABLE interviews ADD CONSTRAINT fk_interviews_interviewer FOREIGN KEY (interviewer_id) REFERENCES hiring_managers(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 5. Verify the migration worked
SELECT '✅ Migration complete! Columns and relationships established.' as status;
