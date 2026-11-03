import { Logger, type FactoryProvider } from "@nestjs/common";

import { UNIT_OF_WORK } from "#api/shared/application/ports/index";

import { RETENTION_CONFIG } from "./application/ports/retention/retention-config.port.js";
import { RETENTION_REPOSITORY } from "./application/ports/retention/retention.repository.port.js";
import { NotificationPublisher } from "./application/publishers/delivery/notification.publisher.js";
import { ActivateRetentionExperiment } from "./application/use-cases/retention/activate-retention-experiment.use-case.js";
import { EnrollRetentionExperiment } from "./application/use-cases/retention/enroll-retention-experiment.use-case.js";
import { ProcessRetentionStages } from "./application/use-cases/retention/process-retention-stages.use-case.js";

export const activateRetentionExperimentProvider: FactoryProvider<ActivateRetentionExperiment> = {
  provide: ActivateRetentionExperiment,
  inject: [RETENTION_REPOSITORY, RETENTION_CONFIG, UNIT_OF_WORK],
  useFactory: (
    repository: ConstructorParameters<typeof ActivateRetentionExperiment>[0]["repository"],
    config: ConstructorParameters<typeof ActivateRetentionExperiment>[0]["config"],
    unitOfWork: ConstructorParameters<typeof ActivateRetentionExperiment>[0]["unitOfWork"],
  ) =>
    new ActivateRetentionExperiment({
      repository,
      config,
      unitOfWork,
    }),
};

export const enrollRetentionExperimentProvider: FactoryProvider<EnrollRetentionExperiment> = {
  provide: EnrollRetentionExperiment,
  inject: [RETENTION_REPOSITORY, RETENTION_CONFIG],
  useFactory: (
    repository: ConstructorParameters<typeof EnrollRetentionExperiment>[0]["repository"],
    config: ConstructorParameters<typeof EnrollRetentionExperiment>[0]["config"],
  ) => new EnrollRetentionExperiment({ repository, config }),
};

export const processRetentionStagesProvider: FactoryProvider<ProcessRetentionStages> = {
  provide: ProcessRetentionStages,
  inject: [RETENTION_REPOSITORY, NotificationPublisher, RETENTION_CONFIG, UNIT_OF_WORK],
  useFactory: (
    repository: ConstructorParameters<typeof ProcessRetentionStages>[0]["repository"],
    notificationPublisher: ConstructorParameters<
      typeof ProcessRetentionStages
    >[0]["notificationPublisher"],
    config: ConstructorParameters<typeof ProcessRetentionStages>[0]["config"],
    unitOfWork: ConstructorParameters<typeof ProcessRetentionStages>[0]["unitOfWork"],
  ) =>
    new ProcessRetentionStages({
      repository,
      notificationPublisher,
      config,
      unitOfWork,
      logger: new Logger(ProcessRetentionStages.name),
    }),
};
