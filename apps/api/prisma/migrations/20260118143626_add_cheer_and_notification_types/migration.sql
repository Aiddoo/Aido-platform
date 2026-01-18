/*
  Warnings:

  - The primary key for the `Nudge` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Nudge` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'FOLLOW_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'CHEER_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'FRIEND_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE 'MORNING_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE 'EVENING_REMINDER';

-- AlterTable
ALTER TABLE "Nudge" DROP CONSTRAINT "Nudge_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Nudge_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "Cheer" (
    "id" SERIAL NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "message" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Cheer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cheer_receiverId_createdAt_idx" ON "Cheer"("receiverId", "createdAt");

-- CreateIndex
CREATE INDEX "Cheer_senderId_createdAt_idx" ON "Cheer"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "Cheer_senderId_receiverId_createdAt_idx" ON "Cheer"("senderId", "receiverId", "createdAt");

-- AddForeignKey
ALTER TABLE "Cheer" ADD CONSTRAINT "Cheer_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cheer" ADD CONSTRAINT "Cheer_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
