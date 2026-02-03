-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'ADMIN_BROADCAST';
ALTER TYPE "NotificationType" ADD VALUE 'ADMIN_TARGETED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER';
