-- Notification dedup: partial unique indexes
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
