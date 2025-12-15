-- ============================================
-- MIGRATION: Add custom_fields JSONB for Dynamic Extraction
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Add custom_fields JSONB column for dynamic/job-specific fields
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';

-- 2. Add the fixed columns that the core system needs
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS sold_to_finance BOOLEAN DEFAULT FALSE;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS is_founder BOOLEAN DEFAULT FALSE;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS startup_experience BOOLEAN DEFAULT FALSE;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS enterprise_experience BOOLEAN DEFAULT FALSE;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS max_acv_mentioned INT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS quota_attainment FLOAT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS sales_methodologies JSONB DEFAULT '[]';

-- 3. Add Data Quality columns
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS missing_required JSONB DEFAULT '[]';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS missing_preferred JSONB DEFAULT '[]';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS red_flags JSONB DEFAULT '[]';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS red_flag_count INT DEFAULT 0;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS completeness INT DEFAULT 0;

-- 4. Index on custom_fields for efficient querying
CREATE INDEX IF NOT EXISTS idx_candidates_custom_fields ON candidates USING GIN(custom_fields);

-- 5. Verify the migration
SELECT '✅ Migration complete! Added custom_fields JSONB column for dynamic extraction.' as status;
