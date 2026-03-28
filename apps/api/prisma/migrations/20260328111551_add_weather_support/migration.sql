-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'WEATHER_MORNING';
ALTER TYPE "NotificationType" ADD VALUE 'WEATHER_EVENING';

-- AlterTable
ALTER TABLE "UserPreference" ADD COLUMN     "weatherEveningEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "weatherEveningHour" INTEGER NOT NULL DEFAULT 18,
ADD COLUMN     "weatherEveningMinute" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "weatherMorningEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "weatherMorningHour" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "weatherMorningMinute" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "UserLocation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "gridX" INTEGER NOT NULL,
    "gridY" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserLocation_userId_key" ON "UserLocation"("userId");

-- CreateIndex
CREATE INDEX "UserPreference_pushEnabled_weatherMorningEnabled_timezone_w_idx" ON "UserPreference"("pushEnabled", "weatherMorningEnabled", "timezone", "weatherMorningHour", "weatherMorningMinute");

-- CreateIndex
CREATE INDEX "UserPreference_pushEnabled_weatherEveningEnabled_timezone_w_idx" ON "UserPreference"("pushEnabled", "weatherEveningEnabled", "timezone", "weatherEveningHour", "weatherEveningMinute");

-- AddForeignKey
ALTER TABLE "UserLocation" ADD CONSTRAINT "UserLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
