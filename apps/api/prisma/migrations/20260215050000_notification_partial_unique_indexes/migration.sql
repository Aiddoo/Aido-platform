-- DropIndex
DROP INDEX IF EXISTS "Notification_daily_dedup";
DROP INDEX IF EXISTS "Notification_friend_dedup";

-- Partial unique index: friendId가 NULL인 타입용 (DAILY_COMPLETE, MORNING_REMINDER, EVENING_REMINDER)
CREATE UNIQUE INDEX "Notification_daily_dedup"
  ON "Notification" ("userId", "type", "notificationDate")
  WHERE "notificationDate" IS NOT NULL AND "friendId" IS NULL;

-- Partial unique index: friendId가 있는 타입용 (FRIEND_COMPLETED)
CREATE UNIQUE INDEX "Notification_friend_dedup"
  ON "Notification" ("userId", "type", "friendId", "notificationDate")
  WHERE "notificationDate" IS NOT NULL AND "friendId" IS NOT NULL;
