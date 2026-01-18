/*
  Warnings:

  - You are about to drop the column `actionTarget` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `actionType` on the `Notification` table. All the data in the column will be lost.
  - The `nudgeId` column on the `Notification` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "actionTarget",
DROP COLUMN "actionType",
ADD COLUMN     "cheerId" INTEGER,
ADD COLUMN     "route" VARCHAR(200),
DROP COLUMN "nudgeId",
ADD COLUMN     "nudgeId" INTEGER;

-- DropEnum
DROP TYPE "NotificationActionType";
