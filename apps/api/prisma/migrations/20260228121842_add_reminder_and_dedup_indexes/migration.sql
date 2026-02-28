-- CreateIndex
CREATE INDEX "Notification_userId_type_notificationDate_idx" ON "Notification"("userId", "type", "notificationDate");

-- CreateIndex
CREATE INDEX "UserPreference_pushEnabled_timezone_morningReminderHour_idx" ON "UserPreference"("pushEnabled", "timezone", "morningReminderHour");

-- CreateIndex
CREATE INDEX "UserPreference_pushEnabled_timezone_eveningReminderHour_idx" ON "UserPreference"("pushEnabled", "timezone", "eveningReminderHour");
