import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { NotificationNotificationsModule } from "../notifications/notification-notifications.public.js";
import { RetentionEnrollmentPort } from "./application/ports/retention-enrollment.port.js";
import { RetentionQueueProcessor } from "./infrastructure/jobs/retention-queue.processor.js";
import { RetentionStageSweepScheduler } from "./infrastructure/jobs/retention-stage-sweep.scheduler.js";
import { notificationRetentionAssignmentsConfig } from "./notification-retention-assignments.config.js";
import { NOTIFICATION_RETENTION_ASSIGNMENTS_PROVIDERS } from "./notification-retention-assignments.providers.js";

@Module({
  imports: [
    NotificationNotificationsModule,
    ConfigModule.forFeature(notificationRetentionAssignmentsConfig),
  ],
  providers: [
    ...NOTIFICATION_RETENTION_ASSIGNMENTS_PROVIDERS,
    RetentionStageSweepScheduler,
    RetentionQueueProcessor,
  ],
  exports: [RetentionEnrollmentPort],
})
export class NotificationRetentionAssignmentsModule {}
