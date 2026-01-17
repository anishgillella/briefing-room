-- ============================================
-- MULTI-TENANCY MIGRATION
-- Phase 1: Organizations & Auth Fields
--
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. CREATE ORGANIZATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for slug lookups
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- Disable RLS for development
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON organizations TO postgres, anon, authenticated, service_role;

-- ============================================
-- 2. ADD AUTH FIELDS TO RECRUITERS
-- ============================================

-- Add organization_id column
ALTER TABLE recruiters
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add password_hash for authentication
ALTER TABLE recruiters
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Add role column (recruiter or admin)
ALTER TABLE recruiters
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'recruiter';

-- Add is_active flag
ALTER TABLE recruiters
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Add last_login tracking
ALTER TABLE recruiters
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Add role check constraint
DO $$ BEGIN
    ALTER TABLE recruiters ADD CONSTRAINT recruiters_role_check
    CHECK (role IN ('recruiter', 'admin'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_recruiters_organization ON recruiters(organization_id);
CREATE INDEX IF NOT EXISTS idx_recruiters_email_lookup ON recruiters(email);
CREATE INDEX IF NOT EXISTS idx_recruiters_active ON recruiters(is_active) WHERE is_active = TRUE;

-- ============================================
-- 3. ADD ORGANIZATION TO JOB_POSTINGS
-- ============================================

-- Add organization_id column
ALTER TABLE job_postings
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add created_by_recruiter_id to track who created the job
ALTER TABLE job_postings
ADD COLUMN IF NOT EXISTS created_by_recruiter_id UUID REFERENCES recruiters(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_job_postings_organization ON job_postings(organization_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_created_by ON job_postings(created_by_recruiter_id);

-- ============================================
-- 4. ADD CONDUCTED_BY TO INTERVIEWS
-- ============================================

-- Add conducted_by_recruiter_id to track who ran the interview
ALTER TABLE interviews
ADD COLUMN IF NOT EXISTS conducted_by_recruiter_id UUID REFERENCES recruiters(id) ON DELETE SET NULL;

-- Create index
CREATE INDEX IF NOT EXISTS idx_interviews_conducted_by ON interviews(conducted_by_recruiter_id);

-- ============================================
-- 5. CREATE DEFAULT ORGANIZATION
-- ============================================

-- Insert default organization for existing data
INSERT INTO organizations (name, slug, settings)
VALUES ('Demo Organization', 'demo', '{"is_default": true}')
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 6. BACKFILL EXISTING DATA
-- ============================================

-- Link existing recruiters to default organization
UPDATE recruiters
SET organization_id = (SELECT id FROM organizations WHERE slug = 'demo')
WHERE organization_id IS NULL;

-- Link existing jobs to default organization
UPDATE job_postings
SET organization_id = (SELECT id FROM organizations WHERE slug = 'demo')
WHERE organization_id IS NULL;

-- Set existing recruiters as active
UPDATE recruiters
SET is_active = TRUE
WHERE is_active IS NULL;

-- Set existing recruiters role to 'recruiter'
UPDATE recruiters
SET role = 'recruiter'
WHERE role IS NULL;

-- ============================================
-- 7. ADD UPDATED_AT TRIGGER FOR ORGANIZATIONS
-- ============================================

-- Ensure the trigger function exists (may already exist from base schema)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger for organizations
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. VERIFICATION QUERIES
-- ============================================

-- Run these to verify the migration worked:

-- Check organizations table
-- SELECT * FROM organizations;

-- Check recruiters have new columns
-- SELECT id, name, email, organization_id, role, is_active FROM recruiters LIMIT 5;

-- Check job_postings have new columns
-- SELECT id, title, organization_id, created_by_recruiter_id FROM job_postings LIMIT 5;

-- Check interviews have new column
-- SELECT id, candidate_id, conducted_by_recruiter_id FROM interviews LIMIT 5;

-- ============================================
-- DONE!
-- Proceed to Phase 2: Backend Auth
-- ============================================
