-- DropForeignKey
ALTER TABLE "Friendship" DROP CONSTRAINT IF EXISTS "Friendship_friendId_fkey";
ALTER TABLE "Friendship" DROP CONSTRAINT IF EXISTS "Friendship_userId_fkey";

-- DropTable
DROP TABLE IF EXISTS "Friendship";

-- DropEnum
DROP TYPE IF EXISTS "FriendshipStatus";

-- AlterEnum: Remove old values from NotificationType
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
CREATE TYPE "NotificationType" AS ENUM ('TODO_REMINDER', 'TODO_SHARED', 'WEEKLY_ACHIEVEMENT', 'SYSTEM_NOTICE', 'FOLLOW_NEW', 'NUDGE_RECEIVED', 'DAILY_COMPLETE');
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotificationType" USING ("type"::text::"NotificationType");
DROP TYPE "NotificationType_old";

-- AlterTable: Add friendCode to User
ALTER TABLE "User" ADD COLUMN "friendCode" VARCHAR(8);

-- Update existing users with random friendCode (if any)
UPDATE "User" SET "friendCode" = UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 8)) WHERE "friendCode" IS NULL;

-- Make friendCode NOT NULL after populating
ALTER TABLE "User" ALTER COLUMN "friendCode" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_friendCode_key" ON "User"("friendCode");

-- AlterTable: Add nudgeId to Notification
ALTER TABLE "Notification" ADD COLUMN "nudgeId" TEXT;

-- CreateTable: Follow
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Follow_followerId_idx" ON "Follow"("followerId");
CREATE INDEX "Follow_followingId_idx" ON "Follow"("followingId");
CREATE UNIQUE INDEX "Follow_followerId_followingId_key" ON "Follow"("followerId", "followingId");

-- CreateTable: Nudge
CREATE TABLE "Nudge" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "todoId" INTEGER NOT NULL,
    "message" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Nudge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Nudge_receiverId_createdAt_idx" ON "Nudge"("receiverId", "createdAt");
CREATE INDEX "Nudge_senderId_createdAt_idx" ON "Nudge"("senderId", "createdAt");
CREATE INDEX "Nudge_todoId_idx" ON "Nudge"("todoId");
CREATE INDEX "Nudge_senderId_todoId_createdAt_idx" ON "Nudge"("senderId", "todoId", "createdAt");

-- CreateTable: DailyCompletion
CREATE TABLE "DailyCompletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalTodos" INTEGER NOT NULL,
    "completedTodos" INTEGER NOT NULL,
    "achievedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyCompletion_userId_date_idx" ON "DailyCompletion"("userId", "date");
CREATE UNIQUE INDEX "DailyCompletion_userId_date_key" ON "DailyCompletion"("userId", "date");

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nudge" ADD CONSTRAINT "Nudge_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Nudge" ADD CONSTRAINT "Nudge_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Nudge" ADD CONSTRAINT "Nudge_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "Todo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCompletion" ADD CONSTRAINT "DailyCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_nudgeId_fkey" FOREIGN KEY ("nudgeId") REFERENCES "Nudge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
