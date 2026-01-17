-- ============================================
-- PERSON PROFILE FIELDS MIGRATION
-- Run this in Supabase SQL Editor
--
-- This migration adds profile fields to the persons table
-- to store enrichment data from LinkedIn/Crustdata.
-- ============================================

-- ============================================
-- 1. ADD PROFILE FIELDS TO PERSONS TABLE
-- ============================================

-- Make email nullable (to support LinkedIn-sourced candidates without email)
ALTER TABLE persons ALTER COLUMN email DROP NOT NULL;

-- Add profile headline (e.g., "Senior Software Engineer at Google")
ALTER TABLE persons
ADD COLUMN IF NOT EXISTS headline VARCHAR(500);

-- Add professional summary/bio
ALTER TABLE persons
ADD COLUMN IF NOT EXISTS summary TEXT;

-- Add current job title
ALTER TABLE persons
ADD COLUMN IF NOT EXISTS current_title VARCHAR(255);

-- Add current company name
ALTER TABLE persons
ADD COLUMN IF NOT EXISTS current_company VARCHAR(255);

-- Add location (city, state/country)
ALTER TABLE persons
ADD COLUMN IF NOT EXISTS location VARCHAR(255);

-- Add years of experience
ALTER TABLE persons
ADD COLUMN IF NOT EXISTS years_experience FLOAT;

-- Add skills as JSONB array
ALTER TABLE persons
ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]';

-- Add work history as JSONB array of objects
ALTER TABLE persons
ADD COLUMN IF NOT EXISTS work_history JSONB DEFAULT '[]';

-- Add education as JSONB array of objects
ALTER TABLE persons
ADD COLUMN IF NOT EXISTS education JSONB DEFAULT '[]';

-- Add raw enrichment data for reference
ALTER TABLE persons
ADD COLUMN IF NOT EXISTS enrichment_data JSONB;

-- ============================================
-- 2. CREATE INDEXES FOR SEARCH
-- ============================================

-- Index for LinkedIn URL lookups (deduplication)
CREATE INDEX IF NOT EXISTS idx_persons_linkedin_url ON persons(linkedin_url);

-- Index for location filtering
CREATE INDEX IF NOT EXISTS idx_persons_location ON persons(location);

-- Index for company filtering
CREATE INDEX IF NOT EXISTS idx_persons_current_company ON persons(current_company);

-- GIN index for skills array search
CREATE INDEX IF NOT EXISTS idx_persons_skills ON persons USING GIN (skills);

-- ============================================
-- 3. UPDATE EXISTING DATA
-- ============================================

-- Initialize empty arrays for existing rows that have NULL
UPDATE persons SET skills = '[]' WHERE skills IS NULL;
UPDATE persons SET work_history = '[]' WHERE work_history IS NULL;
UPDATE persons SET education = '[]' WHERE education IS NULL;

-- ============================================
-- VERIFICATION
-- ============================================
-- Run this to verify the migration:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'persons'
-- ORDER BY ordinal_position;
