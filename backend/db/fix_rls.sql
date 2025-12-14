-- ============================================
-- RLS FIX: Run this in Supabase SQL Editor
-- This allows the service role key to bypass RLS
-- ============================================

-- Option 1: Disable RLS entirely (for development)
ALTER TABLE job_postings DISABLE ROW LEVEL SECURITY;
ALTER TABLE candidates DISABLE ROW LEVEL SECURITY;
ALTER TABLE prebriefs DISABLE ROW LEVEL SECURITY;
ALTER TABLE interviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts DISABLE ROW LEVEL SECURITY;
ALTER TABLE analytics DISABLE ROW LEVEL SECURITY;
ALTER TABLE questions_asked DISABLE ROW LEVEL SECURITY;

-- Grant permissions to authenticated users
GRANT ALL ON job_postings TO authenticated;
GRANT ALL ON candidates TO authenticated;
GRANT ALL ON prebriefs TO authenticated;
GRANT ALL ON interviews TO authenticated;
GRANT ALL ON transcripts TO authenticated;
GRANT ALL ON analytics TO authenticated;
GRANT ALL ON questions_asked TO authenticated;

-- Grant permissions to service role (for backend operations)
GRANT ALL ON job_postings TO service_role;
GRANT ALL ON candidates TO service_role;
GRANT ALL ON prebriefs TO service_role;
GRANT ALL ON interviews TO service_role; 
GRANT ALL ON transcripts TO service_role;
GRANT ALL ON analytics TO service_role;
GRANT ALL ON questions_asked TO service_role;

-- Grant permissions to anon role (for public APIs if needed)
GRANT SELECT ON job_postings TO anon;
GRANT SELECT ON candidates TO anon;
GRANT SELECT ON interviews TO anon;
