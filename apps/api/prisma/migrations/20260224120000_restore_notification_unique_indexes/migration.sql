-- Restore partial unique indexes that were accidentally dropped in 20260223010105
-- These indexes are critical for notification deduplication (P2002 catch + skipDuplicates)

-- Partial unique index: friendId가 NULL인 타입용 (DAILY_COMPLETE, MORNING_REMINDER, EVENING_REMINDER)
CREATE UNIQUE INDEX "Notification_daily_dedup"
  ON "Notification" ("userId", "type", "notificationDate")
  WHERE "notificationDate" IS NOT NULL AND "friendId" IS NULL;

-- Partial unique index: friendId가 있는 타입용 (FRIEND_COMPLETED)
CREATE UNIQUE INDEX "Notification_friend_dedup"
  ON "Notification" ("userId", "type", "friendId", "notificationDate")
  WHERE "notificationDate" IS NOT NULL AND "friendId" IS NOT NULL;
