-- DropIndex
DROP INDEX "Notification_daily_dedup";

-- DropIndex
DROP INDEX "Notification_friend_dedup";

-- AlterTable
ALTER TABLE "RecurringSuggestion" ADD COLUMN     "suggestedCategoryId" INTEGER;

-- CreateIndex
CREATE INDEX "RecurringSuggestion_userId_expiresAt_idx" ON "RecurringSuggestion"("userId", "expiresAt");
