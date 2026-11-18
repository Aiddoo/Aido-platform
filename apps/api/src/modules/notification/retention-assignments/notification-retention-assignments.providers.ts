import type { Provider } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";

import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { PublishNotificationUseCase } from "../notifications/notification-notifications.public.js";
import { ExperimentAssignerPort } from "./application/ports/experiment-assigner.port.js";
import { RetentionAssignmentRepositoryPort } from "./application/ports/retention-assignment.repository.port.js";
import { RetentionConfigPort } from "./application/ports/retention-config.port.js";
import { RetentionEnrollmentPort } from "./application/ports/retention-enrollment.port.js";
import { ActivateRetentionExperimentUseCase } from "./application/use-cases/activate-retention-experiment.use-case.js";
import { EnrollRetentionExperimentUseCase } from "./application/use-cases/enroll-retention-experiment.use-case.js";
import { ProcessRetentionStagesUseCase } from "./application/use-cases/process-retention-stages.use-case.js";
import { DeterministicHashExperimentAssignerAdapter } from "./infrastructure/adapters/deterministic-hash-experiment-assigner.adapter.js";
import { RetentionEnrollmentAdapter } from "./infrastructure/adapters/retention-enrollment.adapter.js";
import { DrizzleRetentionAssignmentRepository } from "./infrastructure/persistence/drizzle-retention-assignment.repository.js";
import { notificationRetentionAssignmentsConfig } from "./notification-retention-assignments.config.js";

export const NOTIFICATION_RETENTION_ASSIGNMENTS_PERSISTENCE_PROVIDERS: Provider[] = [
  DrizzleRetentionAssignmentRepository,
  { provide: RetentionAssignmentRepositoryPort, useExisting: DrizzleRetentionAssignmentRepository },
];

export const NOTIFICATION_RETENTION_ASSIGNMENTS_USE_CASE_PROVIDERS: Provider[] = [
  provideUseCase(ActivateRetentionExperimentUseCase, {
    repository: RetentionAssignmentRepositoryPort,
    config: RetentionConfigPort,
    unitOfWork: UnitOfWorkPort,
    clock: ClockPort,
  }),
  provideUseCase(EnrollRetentionExperimentUseCase, {
    repository: RetentionAssignmentRepositoryPort,
    config: RetentionConfigPort,
    experimentAssigner: ExperimentAssignerPort,
    unitOfWork: UnitOfWorkPort,
    clock: ClockPort,
  }),
  provideUseCase(ProcessRetentionStagesUseCase, {
    repository: RetentionAssignmentRepositoryPort,
    notificationPublisher: PublishNotificationUseCase,
    config: RetentionConfigPort,
    unitOfWork: UnitOfWorkPort,
    clock: ClockPort,
    logger: loggerFor(ProcessRetentionStagesUseCase),
  }),
];

export const NOTIFICATION_RETENTION_ASSIGNMENTS_PROVIDERS: Provider[] = [
  ...NOTIFICATION_RETENTION_ASSIGNMENTS_PERSISTENCE_PROVIDERS,
  ...NOTIFICATION_RETENTION_ASSIGNMENTS_USE_CASE_PROVIDERS,
  {
    provide: RetentionConfigPort,
    inject: [notificationRetentionAssignmentsConfig.KEY],
    useFactory: (
      config: ConfigType<typeof notificationRetentionAssignmentsConfig>,
    ): RetentionConfigPort => config.onboardingV2,
  },
  { provide: ExperimentAssignerPort, useClass: DeterministicHashExperimentAssignerAdapter },
  RetentionEnrollmentAdapter,
  { provide: RetentionEnrollmentPort, useExisting: RetentionEnrollmentAdapter },
];
