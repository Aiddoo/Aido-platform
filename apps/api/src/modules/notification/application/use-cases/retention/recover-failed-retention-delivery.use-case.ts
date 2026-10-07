import { type UnitOfWorkPort } from "#api/shared/application/ports/index";

import { type RetentionRepositoryPort } from "../../ports/retention/retention.repository.port.js";

interface RecoverFailedRetentionDeliveryDependencies {
  readonly repository: Pick<RetentionRepositoryPort, "reopenUnclaimedDispatch">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
}

export class RecoverFailedRetentionDelivery {
  readonly #dependencies: RecoverFailedRetentionDeliveryDependencies;

  constructor(dependencies: RecoverFailedRetentionDeliveryDependencies) {
    this.#dependencies = dependencies;
  }

  execute(input: {
    readonly outboxId: string;
    readonly publishAttempt?: number;
  }): Promise<boolean> {
    return this.#dependencies.unitOfWork.run(() =>
      this.#dependencies.repository.reopenUnclaimedDispatch({
        ...input,
        availableAt: new Date(),
        reason: "RETENTION_RUNTIME_RETRIES_EXHAUSTED",
      }),
    );
  }
}
