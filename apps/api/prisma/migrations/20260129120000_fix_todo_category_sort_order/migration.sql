-- Fix TodoCategory sortOrder (all records have sortOrder = 0)
-- Assigns sequential sortOrder per user based on createdAt

WITH ranked_categories AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY "userId"
            ORDER BY "createdAt" ASC
        ) - 1 AS new_sort_order
    FROM "TodoCategory"
)
UPDATE "TodoCategory" tc
SET "sortOrder" = rc.new_sort_order
FROM ranked_categories rc
WHERE tc.id = rc.id;
