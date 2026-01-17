-- ============================================
-- SOFT DELETE MIGRATION
-- Run this in Supabase SQL Editor
--
-- Adds soft delete support for jobs table.
-- Jobs can be archived (soft deleted) and restored.
-- ============================================

-- Add deleted_at column to job_postings table
ALTER TABLE job_postings
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for efficient filtering of non-deleted jobs
CREATE INDEX IF NOT EXISTS idx_job_postings_deleted_at
ON job_postings(deleted_at)
WHERE deleted_at IS NULL;

-- Create index for listing archived jobs
CREATE INDEX IF NOT EXISTS idx_job_postings_archived
ON job_postings(deleted_at)
WHERE deleted_at IS NOT NULL;

-- Update the job_dashboard_view to exclude archived jobs by default
DROP VIEW IF EXISTS job_dashboard_view;
CREATE VIEW job_dashboard_view AS
SELECT
    j.id,
    j.title,
    j.status,
    j.created_at,
    j.updated_at,
    j.deleted_at,
    j.deleted_at IS NOT NULL AS is_archived,
    COUNT(DISTINCT c.id) AS candidate_count,
    COUNT(DISTINCT CASE WHEN c.pipeline_status IN ('round_1', 'round_2', 'round_3', 'decision_pending') THEN c.id END) AS in_progress_count,
    COUNT(DISTINCT CASE WHEN i.status = 'completed' THEN c.id END) AS interviewed_count,
    COUNT(DISTINCT CASE WHEN c.pipeline_status = 'new' THEN c.id END) AS pending_count,
    AVG(a.overall_score) AS avg_score
FROM job_postings j
LEFT JOIN candidates c ON j.id = c.job_posting_id
LEFT JOIN interviews i ON c.id = i.candidate_id
LEFT JOIN analytics a ON i.id = a.interview_id
GROUP BY j.id, j.title, j.status, j.created_at, j.updated_at, j.deleted_at;

-- Create a view for active (non-archived) jobs only
CREATE OR REPLACE VIEW active_jobs_view AS
SELECT * FROM job_dashboard_view WHERE deleted_at IS NULL;

-- Create a view for archived jobs only
CREATE OR REPLACE VIEW archived_jobs_view AS
SELECT * FROM job_dashboard_view WHERE deleted_at IS NOT NULL;

-- ============================================
-- DONE!
-- ============================================

-- To verify the migration:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'job_postings' AND column_name = 'deleted_at';
-- SELECT * FROM active_jobs_view;
-- SELECT * FROM archived_jobs_view;
