import { Logger, type FactoryProvider } from "@nestjs/common";

import { UNIT_OF_WORK } from "#api/shared/application/ports/index";

import { PublishNotificationUseCase } from "../push/application/use-cases/publish-notification.use-case.js";
import { RETENTION_CONFIG } from "./application/ports/retention-config.port.js";
import { RETENTION_REPOSITORY } from "./application/ports/retention.repository.port.js";
import { ActivateRetentionExperimentUseCase } from "./application/use-cases/activate-retention-experiment.use-case.js";
import { EnrollRetentionExperimentUseCase } from "./application/use-cases/enroll-retention-experiment.use-case.js";
import { ProcessRetentionStagesUseCase } from "./application/use-cases/process-retention-stages.use-case.js";

export const activateRetentionExperimentUseCaseProvider: FactoryProvider<ActivateRetentionExperimentUseCase> =
  {
    provide: ActivateRetentionExperimentUseCase,
    inject: [RETENTION_REPOSITORY, RETENTION_CONFIG, UNIT_OF_WORK],
    useFactory: (
      repository: ConstructorParameters<typeof ActivateRetentionExperimentUseCase>[0]["repository"],
      config: ConstructorParameters<typeof ActivateRetentionExperimentUseCase>[0]["config"],
      unitOfWork: ConstructorParameters<typeof ActivateRetentionExperimentUseCase>[0]["unitOfWork"],
    ) =>
      new ActivateRetentionExperimentUseCase({
        repository,
        config,
        unitOfWork,
      }),
  };

export const enrollRetentionExperimentUseCaseProvider: FactoryProvider<EnrollRetentionExperimentUseCase> =
  {
    provide: EnrollRetentionExperimentUseCase,
    inject: [RETENTION_REPOSITORY, RETENTION_CONFIG],
    useFactory: (
      repository: ConstructorParameters<typeof EnrollRetentionExperimentUseCase>[0]["repository"],
      config: ConstructorParameters<typeof EnrollRetentionExperimentUseCase>[0]["config"],
    ) => new EnrollRetentionExperimentUseCase({ repository, config }),
  };

export const processRetentionStagesUseCaseProvider: FactoryProvider<ProcessRetentionStagesUseCase> =
  {
    provide: ProcessRetentionStagesUseCase,
    inject: [RETENTION_REPOSITORY, PublishNotificationUseCase, RETENTION_CONFIG, UNIT_OF_WORK],
    useFactory: (
      repository: ConstructorParameters<typeof ProcessRetentionStagesUseCase>[0]["repository"],
      notificationPublisher: ConstructorParameters<
        typeof ProcessRetentionStagesUseCase
      >[0]["notificationPublisher"],
      config: ConstructorParameters<typeof ProcessRetentionStagesUseCase>[0]["config"],
      unitOfWork: ConstructorParameters<typeof ProcessRetentionStagesUseCase>[0]["unitOfWork"],
    ) =>
      new ProcessRetentionStagesUseCase({
        repository,
        notificationPublisher,
        config,
        unitOfWork,
        logger: new Logger(ProcessRetentionStagesUseCase.name),
      }),
  };
