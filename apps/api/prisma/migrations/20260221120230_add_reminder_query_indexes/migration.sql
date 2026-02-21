-- CreateIndex
CREATE INDEX "Notification_todoId_type_createdAt_idx" ON "Notification"("todoId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "Todo_completed_scheduledTime_idx" ON "Todo"("completed", "scheduledTime");

-- CreateIndex
CREATE INDEX "UserPreference_pushEnabled_timezone_idx" ON "UserPreference"("pushEnabled", "timezone");
