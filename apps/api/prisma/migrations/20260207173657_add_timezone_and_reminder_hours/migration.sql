-- AlterTable
ALTER TABLE "UserPreference" ADD COLUMN     "eveningReminderHour" INTEGER NOT NULL DEFAULT 18,
ADD COLUMN     "morningReminderHour" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC';
