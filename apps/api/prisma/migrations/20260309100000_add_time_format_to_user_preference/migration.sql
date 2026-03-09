-- CreateEnum
CREATE TYPE "TimeFormat" AS ENUM ('TWELVE_HOUR', 'TWENTY_FOUR_HOUR');

-- AlterTable
ALTER TABLE "UserPreference" ADD COLUMN "timeFormat" "TimeFormat" NOT NULL DEFAULT 'TWELVE_HOUR';
