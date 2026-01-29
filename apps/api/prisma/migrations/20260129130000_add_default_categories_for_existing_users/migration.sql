-- Add default categories for existing users who don't have any categories
-- This fixes social login users who were created before the category creation logic was added

INSERT INTO "TodoCategory" ("userId", "name", "color", "sortOrder", "createdAt", "updatedAt")
SELECT
    u.id AS "userId",
    '중요한 일' AS "name",
    '#FFB3B3' AS "color",
    0 AS "sortOrder",
    NOW() AS "createdAt",
    NOW() AS "updatedAt"
FROM "User" u
WHERE NOT EXISTS (
    SELECT 1 FROM "TodoCategory" tc WHERE tc."userId" = u.id
);

INSERT INTO "TodoCategory" ("userId", "name", "color", "sortOrder", "createdAt", "updatedAt")
SELECT
    u.id AS "userId",
    '할 일' AS "name",
    '#FF6B43' AS "color",
    1 AS "sortOrder",
    NOW() AS "createdAt",
    NOW() AS "updatedAt"
FROM "User" u
WHERE NOT EXISTS (
    SELECT 1 FROM "TodoCategory" tc WHERE tc."userId" = u.id AND tc."name" = '할 일'
);
