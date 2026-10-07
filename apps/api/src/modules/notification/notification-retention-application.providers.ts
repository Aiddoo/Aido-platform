import { Logger, type FactoryProvider } from "@nestjs/common";

import { UNIT_OF_WORK } from "#api/shared/application/ports/index";

import { NOTIFICATION_CACHE } from "./application/ports/delivery/notification-cache.port.js";
import { RETENTION_CONFIG } from "./application/ports/retention/retention-config.port.js";
import { RETENTION_JOB_ENQUEUER } from "./application/ports/retention/retention-job-enqueuer.port.js";
import { RETENTION_PUSH_SENDER } from "./application/ports/retention/retention-push-sender.port.js";
import { RETENTION_REPOSITORY } from "./application/ports/retention/retention.repository.port.js";
import { ActivateRetentionExperiment } from "./application/use-cases/retention/activate-retention-experiment.use-case.js";
import { DispatchRetentionPush } from "./application/use-cases/retention/dispatch-retention-push.use-case.js";
import { EnrollRetentionExperiment } from "./application/use-cases/retention/enroll-retention-experiment.use-case.js";
import { ProcessRetentionStages } from "./application/use-cases/retention/process-retention-stages.use-case.js";
import { RecoverFailedRetentionDelivery } from "./application/use-cases/retention/recover-failed-retention-delivery.use-case.js";
import { RelayRetentionOutbox } from "./application/use-cases/retention/relay-retention-outbox.use-case.js";

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

export const dispatchRetentionPushProvider: FactoryProvider<DispatchRetentionPush> = {
  provide: DispatchRetentionPush,
  inject: [
    RETENTION_REPOSITORY,
    RETENTION_PUSH_SENDER,
    RETENTION_CONFIG,
    UNIT_OF_WORK,
    NOTIFICATION_CACHE,
  ],
  useFactory: (
    repository: ConstructorParameters<typeof DispatchRetentionPush>[0]["repository"],
    sender: ConstructorParameters<typeof DispatchRetentionPush>[0]["sender"],
    config: ConstructorParameters<typeof DispatchRetentionPush>[0]["config"],
    unitOfWork: ConstructorParameters<typeof DispatchRetentionPush>[0]["unitOfWork"],
    cache: ConstructorParameters<typeof DispatchRetentionPush>[0]["cache"],
  ) =>
    new DispatchRetentionPush({
      repository,
      sender,
      config,
      unitOfWork,
      cache,
      logger: new Logger(DispatchRetentionPush.name),
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
  inject: [RETENTION_REPOSITORY, RETENTION_CONFIG, UNIT_OF_WORK],
  useFactory: (
    repository: ConstructorParameters<typeof ProcessRetentionStages>[0]["repository"],
    config: ConstructorParameters<typeof ProcessRetentionStages>[0]["config"],
    unitOfWork: ConstructorParameters<typeof ProcessRetentionStages>[0]["unitOfWork"],
  ) =>
    new ProcessRetentionStages({
      repository,
      config,
      unitOfWork,
      logger: new Logger(ProcessRetentionStages.name),
    }),
};

export const recoverFailedRetentionDeliveryProvider: FactoryProvider<RecoverFailedRetentionDelivery> =
  {
    provide: RecoverFailedRetentionDelivery,
    inject: [RETENTION_REPOSITORY, UNIT_OF_WORK],
    useFactory: (
      repository: ConstructorParameters<typeof RecoverFailedRetentionDelivery>[0]["repository"],
      unitOfWork: ConstructorParameters<typeof RecoverFailedRetentionDelivery>[0]["unitOfWork"],
    ) => new RecoverFailedRetentionDelivery({ repository, unitOfWork }),
  };

export const relayRetentionOutboxProvider: FactoryProvider<RelayRetentionOutbox> = {
  provide: RelayRetentionOutbox,
  inject: [RETENTION_REPOSITORY, RETENTION_JOB_ENQUEUER, RETENTION_CONFIG, UNIT_OF_WORK],
  useFactory: (
    repository: ConstructorParameters<typeof RelayRetentionOutbox>[0]["repository"],
    enqueuer: ConstructorParameters<typeof RelayRetentionOutbox>[0]["enqueuer"],
    config: ConstructorParameters<typeof RelayRetentionOutbox>[0]["config"],
    unitOfWork: ConstructorParameters<typeof RelayRetentionOutbox>[0]["unitOfWork"],
  ) =>
    new RelayRetentionOutbox({
      repository,
      enqueuer,
      config,
      unitOfWork,
      logger: new Logger(RelayRetentionOutbox.name),
    }),
};
