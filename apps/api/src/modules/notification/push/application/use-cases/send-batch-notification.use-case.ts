import { type AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import { type UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import type { CreateNotificationData } from "../../../inbox/application/ports/notification-draft.port.js";
import type { FinalizeBatchNotificationUseCase } from "./finalize-batch-notification.use-case.js";
import type { PersistBatchNotificationUseCase } from "./persist-batch-notification.use-case.js";

interface SendBatchNotificationDependencies {
  readonly persistBatchNotificationUseCase: Pick<PersistBatchNotificationUseCase, "execute">;
  readonly finalizeBatchNotificationUseCase: Pick<FinalizeBatchNotificationUseCase, "execute">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly afterCommitTasks: Pick<AfterCommitTaskRegistryPort, "register">;
}

export class SendBatchNotificationUseCase {
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
