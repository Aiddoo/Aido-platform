import type { Provider } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";

import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { PublishNotificationUseCase } from "../push/application/use-cases/publish-notification.use-case.js";
import { ExperimentAssignerPort } from "./application/ports/experiment-assigner.port.js";
import { RetentionConfigPort } from "./application/ports/retention-config.port.js";
import { RetentionEnrollmentPort } from "./application/ports/retention-enrollment.port.js";
import { RetentionRepositoryPort } from "./application/ports/retention.repository.port.js";
import { ActivateRetentionExperimentUseCase } from "./application/use-cases/activate-retention-experiment.use-case.js";
import { EnrollRetentionExperimentUseCase } from "./application/use-cases/enroll-retention-experiment.use-case.js";
import { ProcessRetentionStagesUseCase } from "./application/use-cases/process-retention-stages.use-case.js";
import { DeterministicHashExperimentAssignerAdapter } from "./infrastructure/adapters/deterministic-hash-experiment-assigner.adapter.js";
import { RetentionEnrollmentAdapter } from "./infrastructure/adapters/retention-enrollment.adapter.js";
import { DrizzleRetentionRepository } from "./infrastructure/persistence/drizzle-retention.repository.js";
import { notificationRetentionConfig } from "./notification-retention.config.js";

export const NOTIFICATION_RETENTION_PERSISTENCE_PROVIDERS: Provider[] = [
  DrizzleRetentionRepository,
  { provide: RetentionRepositoryPort, useExisting: DrizzleRetentionRepository },
];

export const NOTIFICATION_RETENTION_USE_CASE_PROVIDERS: Provider[] = [
  provideUseCase(ActivateRetentionExperimentUseCase, {
    repository: RetentionRepositoryPort,
    config: RetentionConfigPort,
    unitOfWork: UnitOfWorkPort,
    clock: ClockPort,
  }),
  provideUseCase(EnrollRetentionExperimentUseCase, {
    repository: RetentionRepositoryPort,
    config: RetentionConfigPort,
    experimentAssigner: ExperimentAssignerPort,
    clock: ClockPort,
  }),
  provideUseCase(ProcessRetentionStagesUseCase, {
    repository: RetentionRepositoryPort,
    notificationPublisher: PublishNotificationUseCase,
    config: RetentionConfigPort,
    unitOfWork: UnitOfWorkPort,
    clock: ClockPort,
    logger: loggerFor(ProcessRetentionStagesUseCase),
  }),
];

export const NOTIFICATION_RETENTION_PROVIDERS: Provider[] = [
  ...NOTIFICATION_RETENTION_PERSISTENCE_PROVIDERS,
  ...NOTIFICATION_RETENTION_USE_CASE_PROVIDERS,
  {
    provide: RetentionConfigPort,
    inject: [notificationRetentionConfig.KEY],
    useFactory: (config: ConfigType<typeof notificationRetentionConfig>): RetentionConfigPort =>
      config.onboardingV2,
  },
  { provide: ExperimentAssignerPort, useClass: DeterministicHashExperimentAssignerAdapter },
  RetentionEnrollmentAdapter,
  { provide: RetentionEnrollmentPort, useExisting: RetentionEnrollmentAdapter },
];
