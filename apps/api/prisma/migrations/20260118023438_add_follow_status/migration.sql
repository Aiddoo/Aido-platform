/*
  Warnings:

  - The `todoId` column on the `Notification` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `updatedAt` to the `Follow` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FollowStatus" AS ENUM ('PENDING', 'ACCEPTED');

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_nudgeId_fkey";

-- DropIndex
DROP INDEX "Follow_followerId_idx";

-- DropIndex
DROP INDEX "Follow_followingId_idx";

-- AlterTable
ALTER TABLE "Follow" ADD COLUMN     "status" "FollowStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "todoId",
ADD COLUMN     "todoId" INTEGER;

-- CreateIndex
CREATE INDEX "Follow_followerId_status_idx" ON "Follow"("followerId", "status");

-- CreateIndex
CREATE INDEX "Follow_followingId_status_idx" ON "Follow"("followingId", "status");
