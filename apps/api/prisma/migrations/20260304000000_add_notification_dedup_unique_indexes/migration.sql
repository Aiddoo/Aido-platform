-- =============================================================================
-- 1. 기존 중복 데이터 정리 (최신 1건만 유지)
-- =============================================================================

-- friendId IS NULL인 중복 제거 (DAILY_COMPLETE, MORNING_REMINDER, EVENING_REMINDER 등)
DELETE FROM "Notification" n
USING (
  SELECT "userId", "type", "notificationDate", MAX("id") AS keep_id
  FROM "Notification"
  WHERE "friendId" IS NULL AND "notificationDate" IS NOT NULL
  GROUP BY "userId", "type", "notificationDate"
  HAVING COUNT(*) > 1
) dupes
WHERE n."userId" = dupes."userId"
  AND n."type" = dupes."type"
  AND n."notificationDate" = dupes."notificationDate"
  AND n."friendId" IS NULL
  AND n."id" <> dupes.keep_id;

-- friendId IS NOT NULL인 중복 제거 (FRIEND_COMPLETED 등)
DELETE FROM "Notification" n
USING (
  SELECT "userId", "type", "friendId", "notificationDate", MAX("id") AS keep_id
  FROM "Notification"
  WHERE "friendId" IS NOT NULL AND "notificationDate" IS NOT NULL
  GROUP BY "userId", "type", "friendId", "notificationDate"
  HAVING COUNT(*) > 1
) dupes
WHERE n."userId" = dupes."userId"
  AND n."type" = dupes."type"
  AND n."friendId" = dupes."friendId"
  AND n."notificationDate" = dupes."notificationDate"
  AND n."id" <> dupes.keep_id;

-- =============================================================================
-- 2. Partial unique indexes 생성
-- =============================================================================

-- friendId IS NULL인 타입 (DAILY_COMPLETE, MORNING_REMINDER, EVENING_REMINDER 등)
CREATE UNIQUE INDEX "Notification_daily_dedup"
  ON "Notification" ("userId", "type", "notificationDate")
  WHERE "friendId" IS NULL AND "notificationDate" IS NOT NULL;

-- friendId IS NOT NULL인 타입 (FRIEND_COMPLETED 등)
CREATE UNIQUE INDEX "Notification_friend_dedup"
  ON "Notification" ("userId", "type", "friendId", "notificationDate")
  WHERE "friendId" IS NOT NULL AND "notificationDate" IS NOT NULL;

-- User 모델: Admin 대시보드 7/30일 필터용 복합 인덱스
CREATE INDEX "User_status_deletedAt_lastLoginAt_idx"
  ON "User" ("status", "deletedAt", "lastLoginAt");
