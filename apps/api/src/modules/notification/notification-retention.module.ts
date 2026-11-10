import { Module } from "@nestjs/common";

import { NotificationPushModule } from "#api/modules/notification/notification-delivery.public";

import { RETENTION_CONFIG } from "./application/ports/retention/retention-config.port.js";
import { RETENTION_ENROLLMENT } from "./application/ports/retention/retention-enrollment.port.js";
import { RETENTION_REPOSITORY } from "./application/ports/retention/retention.repository.port.js";
import { RetentionConfigAdapter } from "./infrastructure/adapters/retention/retention-config.adapter.js";
import { RetentionEnrollmentAdapter } from "./infrastructure/adapters/retention/retention-enrollment.adapter.js";
import { RetentionQueueProcessor } from "./infrastructure/jobs/retention/retention-queue.processor.js";
import { RetentionQueueService } from "./infrastructure/jobs/retention/retention-queue.service.js";
import { DrizzleRetentionRepository } from "./infrastructure/persistence/retention/drizzle-retention.repository.js";
import {
  activateRetentionExperimentProvider,
  enrollRetentionExperimentProvider,
  processRetentionStagesProvider,
} from "./notification-retention-application.providers.js";

@Module({
  imports: [NotificationPushModule],
  providers: [
    RetentionEnrollmentAdapter,
    activateRetentionExperimentProvider,
    enrollRetentionExperimentProvider,
    processRetentionStagesProvider,
    DrizzleRetentionRepository,
    RetentionConfigAdapter,
    RetentionQueueService,
    RetentionQueueProcessor,
    { provide: RETENTION_REPOSITORY, useExisting: DrizzleRetentionRepository },
    { provide: RETENTION_CONFIG, useExisting: RetentionConfigAdapter },
    {
      provide: RETENTION_ENROLLMENT,
      useExisting: RetentionEnrollmentAdapter,
    },
  ],
  exports: [RETENTION_ENROLLMENT],
})
export class NotificationRetentionModule {}
