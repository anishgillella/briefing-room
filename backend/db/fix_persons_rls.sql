-- Fix RLS permissions for persons table
-- Run this in Supabase SQL Editor

-- Option 1: Disable RLS on persons table (simpler for development)
ALTER TABLE persons DISABLE ROW LEVEL SECURITY;

-- Option 2: If you want RLS enabled, create policies
-- Uncomment below if you prefer RLS

-- ALTER TABLE persons ENABLE ROW LEVEL SECURITY;

-- -- Allow all operations for authenticated users (service role)
-- CREATE POLICY "Allow all for service role" ON persons
--     FOR ALL
--     USING (true)
--     WITH CHECK (true);

-- Grant necessary permissions to authenticated role
GRANT ALL ON persons TO authenticated;
GRANT ALL ON persons TO anon;
GRANT ALL ON persons TO service_role;

-- Verify the table exists and permissions
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'persons';
