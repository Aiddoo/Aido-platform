-- DropIndex
DROP INDEX "UserPreference_pushEnabled_timezone_eveningReminderHour_idx";

-- DropIndex
DROP INDEX "UserPreference_pushEnabled_timezone_morningReminderHour_idx";

-- AlterTable
ALTER TABLE "UserPreference" ADD COLUMN     "eveningReminderMinute" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "morningReminderMinute" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "UserPreference_pushEnabled_timezone_morningReminderHour_mor_idx" ON "UserPreference"("pushEnabled", "timezone", "morningReminderHour", "morningReminderMinute");

-- CreateIndex
CREATE INDEX "UserPreference_pushEnabled_timezone_eveningReminderHour_eve_idx" ON "UserPreference"("pushEnabled", "timezone", "eveningReminderHour", "eveningReminderMinute");
