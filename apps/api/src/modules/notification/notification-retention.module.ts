import { Module } from "@nestjs/common";

import { NotificationDeliveryModule } from "#api/modules/notification/notification-delivery.public";

import { RETENTION_CONFIG } from "./application/ports/retention/retention-config.port.js";
import { RETENTION_ENROLLMENT } from "./application/ports/retention/retention-enrollment.port.js";
import { RETENTION_JOB_ENQUEUER } from "./application/ports/retention/retention-job-enqueuer.port.js";
import { RETENTION_PUSH_SENDER } from "./application/ports/retention/retention-push-sender.port.js";
import { RETENTION_REPOSITORY } from "./application/ports/retention/retention.repository.port.js";
import { ExpoRetentionPushSenderAdapter } from "./infrastructure/adapters/retention/expo-retention-push-sender.adapter.js";
import { RetentionConfigAdapter } from "./infrastructure/adapters/retention/retention-config.adapter.js";
import { RetentionEnrollmentAdapter } from "./infrastructure/adapters/retention/retention-enrollment.adapter.js";
import { RetentionQueueProcessor } from "./infrastructure/jobs/retention/retention-queue.processor.js";
import { RetentionQueueService } from "./infrastructure/jobs/retention/retention-queue.service.js";
import { PrismaRetentionRepository } from "./infrastructure/persistence/retention/prisma-retention.repository.js";
import {
  activateRetentionExperimentProvider,
  dispatchRetentionPushProvider,
  enrollRetentionExperimentProvider,
  processRetentionStagesProvider,
  recoverFailedRetentionDeliveryProvider,
  relayRetentionOutboxProvider,
} from "./notification-retention-application.providers.js";

@Module({
  imports: [NotificationDeliveryModule],
  providers: [
    RetentionEnrollmentAdapter,
    activateRetentionExperimentProvider,
    enrollRetentionExperimentProvider,
    processRetentionStagesProvider,
    relayRetentionOutboxProvider,
    dispatchRetentionPushProvider,
    recoverFailedRetentionDeliveryProvider,
    PrismaRetentionRepository,
    RetentionConfigAdapter,
    ExpoRetentionPushSenderAdapter,
    RetentionQueueService,
    RetentionQueueProcessor,
    { provide: RETENTION_REPOSITORY, useExisting: PrismaRetentionRepository },
    { provide: RETENTION_CONFIG, useExisting: RetentionConfigAdapter },
    {
      provide: RETENTION_PUSH_SENDER,
      useExisting: ExpoRetentionPushSenderAdapter,
    },
    { provide: RETENTION_JOB_ENQUEUER, useExisting: RetentionQueueService },
    {
      provide: RETENTION_ENROLLMENT,
      useExisting: RetentionEnrollmentAdapter,
    },
  ],
  exports: [RETENTION_ENROLLMENT],
})
export class NotificationRetentionModule {}
