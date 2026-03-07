-- AlterEnum: NotificationType에 신규 타입 3종 추가
ALTER TYPE "NotificationType" ADD VALUE 'WINBACK';
ALTER TYPE "NotificationType" ADD VALUE 'SOCIAL_DIGEST';
ALTER TYPE "NotificationType" ADD VALUE 'NUDGE_SUGGEST';

-- AlterTable: UserPreference에 스트릭 추적 필드 추가
ALTER TABLE "UserPreference" ADD COLUMN "currentStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UserPreference" ADD COLUMN "longestStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UserPreference" ADD COLUMN "lastCompletedDate" DATE;

-- AlterTable: User에 lastActiveAt 필드 추가
ALTER TABLE "User" ADD COLUMN "lastActiveAt" TIMESTAMP(3);

-- CreateIndex: Win-back/Nudge Suggest 비활성 유저 스캔용
CREATE INDEX "User_deletedAt_lastActiveAt_idx" ON "User"("deletedAt", "lastActiveAt");
