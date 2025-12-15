-- ============================================
-- FIX: Update interview_status CHECK constraint
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Drop the existing constraint
ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_interview_status_check;

-- 2. Add the updated constraint with all valid values
ALTER TABLE candidates 
ADD CONSTRAINT candidates_interview_status_check 
CHECK (interview_status IS NULL OR interview_status IN (
    'not_scheduled',
    'briefing', 
    'in_progress', 
    'completed'
));

-- 3. Verify the fix
SELECT '✅ interview_status constraint updated!' as status;
