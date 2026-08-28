import { Module } from "@nestjs/common";

import { NotificationModule } from "@/notification";

import { RETENTION_CONFIG } from "./application/ports/retention-config.port";
import { RETENTION_ENROLLMENT } from "./application/ports/retention-enrollment.port";
import { RETENTION_JOB_ENQUEUER } from "./application/ports/retention-job-enqueuer.port";
import { RETENTION_PUSH_SENDER } from "./application/ports/retention-push-sender.port";
import { RETENTION_REPOSITORY } from "./application/ports/retention.repository.port";
import { ActivateRetentionExperimentUseCase } from "./application/use-cases/activate-retention-experiment/activate-retention-experiment.use-case";
import { DispatchRetentionPushUseCase } from "./application/use-cases/dispatch-retention-push/dispatch-retention-push.use-case";
import { EnrollRetentionExperimentUseCase } from "./application/use-cases/enroll-retention-experiment/enroll-retention-experiment.use-case";
import { ProcessRetentionStagesUseCase } from "./application/use-cases/process-retention-stages/process-retention-stages.use-case";
import { RecoverFailedRetentionDeliveryUseCase } from "./application/use-cases/recover-failed-retention-delivery/recover-failed-retention-delivery.use-case";
import { RelayRetentionOutboxUseCase } from "./application/use-cases/relay-retention-outbox/relay-retention-outbox.use-case";
import { ExpoRetentionPushSenderAdapter } from "./infrastructure/adapters/expo-retention-push-sender.adapter";
import { RetentionConfigAdapter } from "./infrastructure/adapters/retention-config.adapter";
import { RetentionEnrollmentAdapter } from "./infrastructure/adapters/retention-enrollment.adapter";
import { PrismaRetentionRepository } from "./infrastructure/persistence/prisma-retention.repository";
import { RetentionQueueProcessor } from "./infrastructure/queue/retention-queue.processor";
import { RetentionQueueService } from "./infrastructure/queue/retention-queue.service";

@Module({
	imports: [NotificationModule],
	providers: [
		RetentionEnrollmentAdapter,
		ActivateRetentionExperimentUseCase,
		EnrollRetentionExperimentUseCase,
		ProcessRetentionStagesUseCase,
		RelayRetentionOutboxUseCase,
		DispatchRetentionPushUseCase,
		RecoverFailedRetentionDeliveryUseCase,
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
export class RetentionModule {}
