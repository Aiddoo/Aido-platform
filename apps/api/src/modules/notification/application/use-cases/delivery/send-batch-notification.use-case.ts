import {
  type AfterCommitTaskRegistryPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";

import type { CreateNotificationData } from "../../ports/delivery/notification-data.js";
import type { FinalizeBatchNotification } from "./finalize-batch-notification.use-case.js";
import type { PersistBatchNotification } from "./persist-batch-notification.use-case.js";

interface SendBatchNotificationDependencies {
  readonly persistBatchNotificationUseCase: PersistBatchNotification;
  readonly finalizeBatchNotificationUseCase: FinalizeBatchNotification;
  readonly unitOfWork: UnitOfWorkPort;
  readonly afterCommitTasks: AfterCommitTaskRegistryPort;
}

export class SendBatchNotification {
  readonly #dependencies: SendBatchNotificationDependencies;

  constructor(dependencies: SendBatchNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(dataList: CreateNotificationData[]): Promise<{ count: number }> {
    return this.#dependencies.unitOfWork.run(async () => {
      const persisted = await this.#dependencies.persistBatchNotificationUseCase.execute(dataList);
      if (persisted.count > 0) {
        this.#dependencies.afterCommitTasks.register(async () => {
          await this.#dependencies.finalizeBatchNotificationUseCase.execute(persisted);
        });
      }
      return { count: persisted.count };
    });
  }
}
