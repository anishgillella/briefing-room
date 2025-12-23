-- ============================================
-- CLEANUP DUPLICATE CANDIDATES
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: View duplicates before cleanup
SELECT name, COUNT(*) as count,
       array_agg(id) as all_ids,
       array_agg(json_id) as json_ids
FROM candidates
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY name;

-- Step 2: Find candidates to keep (the one with json_id set)
-- and candidates to delete (the ones without json_id)

-- Create a temp table with the mapping
CREATE TEMP TABLE candidate_cleanup AS
WITH ranked AS (
    SELECT
        id,
        name,
        json_id,
        -- Prefer the one with json_id, otherwise take the first one
        ROW_NUMBER() OVER (
            PARTITION BY name
            ORDER BY
                CASE WHEN json_id IS NOT NULL THEN 0 ELSE 1 END,
                created_at ASC
        ) as rn
    FROM candidates
    WHERE name IN (
        SELECT name FROM candidates GROUP BY name HAVING COUNT(*) > 1
    )
)
SELECT
    r1.id as keep_id,
    r1.name,
    r1.json_id as keep_json_id,
    r2.id as delete_id
FROM ranked r1
JOIN ranked r2 ON r1.name = r2.name AND r2.rn > 1
WHERE r1.rn = 1;

-- View the cleanup plan
SELECT * FROM candidate_cleanup ORDER BY name;

-- Step 3: Migrate interviews from duplicate candidates to the main candidate
UPDATE interviews
SET candidate_id = cc.keep_id
FROM candidate_cleanup cc
WHERE interviews.candidate_id = cc.delete_id;

-- Step 4: Migrate prebriefs from duplicate candidates to the main candidate
UPDATE prebriefs
SET candidate_id = cc.keep_id
FROM candidate_cleanup cc
WHERE prebriefs.candidate_id = cc.delete_id;

-- Step 5: Delete duplicate candidates
DELETE FROM candidates
WHERE id IN (SELECT delete_id FROM candidate_cleanup);

-- Step 6: Verify cleanup
SELECT name, COUNT(*) as count
FROM candidates
GROUP BY name
HAVING COUNT(*) > 1;

-- Should return 0 rows if cleanup was successful

-- Step 7: Verify all candidates now have json_id where possible
SELECT id, name, json_id
FROM candidates
WHERE json_id IS NOT NULL
ORDER BY json_id::int;

-- Cleanup temp table
DROP TABLE IF EXISTS candidate_cleanup;

-- ============================================
-- DONE! All duplicates should be cleaned up
-- ============================================
