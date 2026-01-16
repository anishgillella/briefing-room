-- Migration: Add recruiters table and recruiter_id to job_postings
-- Run this migration to enable multi-recruiter support

-- Create recruiters table
CREATE TABLE IF NOT EXISTS recruiters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_recruiters_email ON recruiters(email);

-- Add recruiter_id column to job_postings if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'job_postings' AND column_name = 'recruiter_id'
    ) THEN
        ALTER TABLE job_postings ADD COLUMN recruiter_id UUID REFERENCES recruiters(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create index on recruiter_id for faster filtering
CREATE INDEX IF NOT EXISTS idx_job_postings_recruiter_id ON job_postings(recruiter_id);

-- Add updated_at trigger for recruiters
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_recruiters_updated_at ON recruiters;
CREATE TRIGGER update_recruiters_updated_at
    BEFORE UPDATE ON recruiters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL ON recruiters TO authenticated;
-- GRANT ALL ON recruiters TO anon;

COMMENT ON TABLE recruiters IS 'Stores recruiter/hiring manager information for job ownership tracking';
COMMENT ON COLUMN recruiters.id IS 'Unique identifier for the recruiter';
COMMENT ON COLUMN recruiters.name IS 'Full name of the recruiter';
COMMENT ON COLUMN recruiters.email IS 'Email address (unique identifier for simple auth)';
COMMENT ON COLUMN job_postings.recruiter_id IS 'Foreign key to the recruiter who owns this job';
