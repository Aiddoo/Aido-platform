-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "notificationDate" DATE;

-- BackfillData
UPDATE "Notification"
SET "notificationDate" = DATE("createdAt")
WHERE type IN ('DAILY_COMPLETE', 'FRIEND_COMPLETED');

-- Deduplicate DAILY_COMPLETE: keep the earliest row per (userId, type, notificationDate)
DELETE FROM "Notification" a
USING "Notification" b
WHERE a.type = 'DAILY_COMPLETE'
  AND a."userId" = b."userId"
  AND a.type = b.type
  AND a."notificationDate" = b."notificationDate"
  AND a."createdAt" > b."createdAt";

-- Deduplicate FRIEND_COMPLETED: keep the earliest row per (userId, type, friendId, notificationDate)
DELETE FROM "Notification" a
USING "Notification" b
WHERE a.type = 'FRIEND_COMPLETED'
  AND a."userId" = b."userId"
  AND a.type = b.type
  AND a."friendId" = b."friendId"
  AND a."notificationDate" = b."notificationDate"
  AND a."createdAt" > b."createdAt";

-- CreateIndex (partial unique index for DAILY_COMPLETE)
CREATE UNIQUE INDEX "Notification_daily_complete_unique"
ON "Notification" ("userId", "type", "notificationDate")
WHERE "type" = 'DAILY_COMPLETE';

-- CreateIndex (partial unique index for FRIEND_COMPLETED)
CREATE UNIQUE INDEX "Notification_friend_completed_unique"
ON "Notification" ("userId", "type", "friendId", "notificationDate")
WHERE "type" = 'FRIEND_COMPLETED';
