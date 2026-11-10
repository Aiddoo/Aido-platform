import { Module } from "@nestjs/common";

import { NotificationPushModule } from "#api/modules/notification/notification-delivery.public";

import { RetentionEnrollmentPort } from "./application/ports/retention-enrollment.port.js";
import { RetentionQueueProcessor } from "./infrastructure/jobs/retention-queue.processor.js";
import { RetentionStageSweepScheduler } from "./infrastructure/jobs/retention-stage-sweep.scheduler.js";
import { NOTIFICATION_RETENTION_PROVIDERS } from "./notification-retention.providers.js";

@Module({
  imports: [NotificationPushModule],
  providers: [
    ...NOTIFICATION_RETENTION_PROVIDERS,
    RetentionStageSweepScheduler,
    RetentionQueueProcessor,
  ],
  exports: [RetentionEnrollmentPort],
})
export class NotificationRetentionModule {}
