-- AlterEnum
ALTER TYPE "SecurityEvent" ADD VALUE 'ACCOUNT_RESTORED';

-- DropIndex
DROP INDEX "Notification_daily_complete_unique";

-- DropIndex
DROP INDEX "Notification_daily_dedup";

-- DropIndex
DROP INDEX "Notification_friend_completed_unique";

-- DropIndex
DROP INDEX "Notification_friend_dedup";

-- AlterTable - OAuthState에 accountRestored 필드 추가
ALTER TABLE "OAuthState" ADD COLUMN "accountRestored" BOOLEAN;
