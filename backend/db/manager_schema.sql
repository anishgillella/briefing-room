-- ============================================
-- MANAGER DASHBOARD SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. HIRING MANAGERS
-- ============================================
CREATE TABLE IF NOT EXISTS hiring_managers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identity (for demo, just name; in production, link to auth.users)
    name TEXT NOT NULL,
    email TEXT,
    
    -- Organization
    department TEXT,
    team TEXT,
    
    -- Cached Metrics (updated on demand or via cron)
    total_candidates_reviewed INT DEFAULT 0,
    total_interviews_conducted INT DEFAULT 0,
    total_offers_made INT DEFAULT 0,
    total_hires INT DEFAULT 0,
    
    -- Rates
    interview_to_offer_rate FLOAT,
    offer_to_hire_rate FLOAT,
    
    -- Timing
    avg_time_to_first_interview_days FLOAT,
    avg_time_in_pipeline_days FLOAT,
    avg_interviews_per_candidate FLOAT,
    
    -- Quality (from employee outcomes, future use)
    avg_hire_performance_score FLOAT,
    hire_retention_rate FLOAT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for listing managers
CREATE INDEX IF NOT EXISTS idx_hiring_managers_team ON hiring_managers(team);
CREATE INDEX IF NOT EXISTS idx_hiring_managers_department ON hiring_managers(department);

-- ============================================
-- 2. TEAM BENCHMARKS
-- ============================================
CREATE TABLE IF NOT EXISTS team_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    team TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Benchmark Rates
    avg_interview_rate FLOAT,
    avg_offer_rate FLOAT,
    avg_hire_rate FLOAT,
    
    -- Benchmark Timing
    avg_time_to_first_interview FLOAT,
    avg_time_in_pipeline FLOAT,
    avg_interviews_per_candidate FLOAT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding benchmarks
CREATE INDEX IF NOT EXISTS idx_team_benchmarks_team ON team_benchmarks(team);
CREATE INDEX IF NOT EXISTS idx_team_benchmarks_period ON team_benchmarks(period_start, period_end);

-- ============================================
-- 3. LINK INTERVIEWS TO MANAGERS
-- ============================================
ALTER TABLE interviews 
ADD COLUMN IF NOT EXISTS hiring_manager_id UUID REFERENCES hiring_managers(id);

-- Index for finding interviews by manager
CREATE INDEX IF NOT EXISTS idx_interviews_manager ON interviews(hiring_manager_id);

-- ============================================
-- 4. SEED SAMPLE MANAGERS (Including Arsene Wenger)
-- ============================================
INSERT INTO hiring_managers (name, email, department, team) VALUES
    ('Arsene Wenger', 'arsene.wenger@company.com', 'Engineering', 'Platform'),
    ('Sarah Chen', 'sarah.chen@company.com', 'Engineering', 'Platform'),
    ('Michael Rodriguez', 'michael.r@company.com', 'Engineering', 'Infrastructure'),
    ('Emily Watson', 'emily.w@company.com', 'Product', 'Growth'),
    ('James Park', 'james.p@company.com', 'Sales', 'Enterprise')
ON CONFLICT DO NOTHING;

-- ============================================
-- 5. SEED SAMPLE BENCHMARKS
-- ============================================
INSERT INTO team_benchmarks (team, period_start, period_end, avg_interview_rate, avg_offer_rate, avg_hire_rate, avg_time_to_first_interview, avg_time_in_pipeline, avg_interviews_per_candidate) VALUES
    ('Platform', '2024-01-01', '2024-12-31', 0.50, 0.08, 0.75, 4.0, 21.0, 3.2),
    ('Infrastructure', '2024-01-01', '2024-12-31', 0.45, 0.10, 0.70, 5.0, 25.0, 3.5),
    ('Growth', '2024-01-01', '2024-12-31', 0.55, 0.12, 0.80, 3.0, 18.0, 2.8),
    ('Enterprise', '2024-01-01', '2024-12-31', 0.40, 0.15, 0.85, 6.0, 30.0, 4.0)
ON CONFLICT DO NOTHING;

-- ============================================
-- 6. ASSIGN ALL EXISTING INTERVIEWS TO ARSENE WENGER
-- ============================================
-- This updates all existing interviews to be associated with Arsene Wenger
UPDATE interviews
SET hiring_manager_id = (
    SELECT id FROM hiring_managers WHERE name = 'Arsene Wenger' LIMIT 1
)
WHERE hiring_manager_id IS NULL;

-- ============================================
-- 7. FIX ROW LEVEL SECURITY (RLS)
-- ============================================
-- Disable RLS on new tables (for demo purposes)
ALTER TABLE hiring_managers DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_benchmarks DISABLE ROW LEVEL SECURITY;

-- Or if RLS is required, create permissive policies:
-- DROP POLICY IF EXISTS "Allow all access to hiring_managers" ON hiring_managers;
-- CREATE POLICY "Allow all access to hiring_managers" ON hiring_managers FOR ALL USING (true) WITH CHECK (true);
-- DROP POLICY IF EXISTS "Allow all access to team_benchmarks" ON team_benchmarks;
-- CREATE POLICY "Allow all access to team_benchmarks" ON team_benchmarks FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- DONE!
-- ============================================
