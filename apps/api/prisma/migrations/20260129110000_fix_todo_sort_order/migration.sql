-- =============================================================================
-- 마이그레이션: 기존 Todo의 sortOrder 순차 설정
-- =============================================================================

-- 기존 Todo들에 대해 사용자별로 createdAt 기준 순차적인 sortOrder 설정
-- 각 사용자의 Todo를 생성일 순서대로 0, 1, 2, ... 로 설정

WITH ranked_todos AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY "userId"
            ORDER BY "createdAt" ASC
        ) - 1 AS new_sort_order
    FROM "Todo"
)
UPDATE "Todo" t
SET "sortOrder" = rt.new_sort_order
FROM ranked_todos rt
WHERE t.id = rt.id;
