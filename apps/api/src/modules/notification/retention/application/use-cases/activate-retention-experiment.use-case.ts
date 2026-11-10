import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import type { RetentionConfigPort } from "../ports/retention-config.port.js";
import type { RetentionRepositoryPort } from "../ports/retention.repository.port.js";

interface ActivateRetentionExperimentDependencies {
  readonly repository: Pick<RetentionRepositoryPort, "activate">;
  readonly config: Pick<RetentionConfigPort, "enabled">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly clock: ClockPort;
}

export class ActivateRetentionExperimentUseCase {
  readonly #dependencies: ActivateRetentionExperimentDependencies;

  constructor(dependencies: ActivateRetentionExperimentDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(userId: string): Promise<void> {
    if (!this.#dependencies.config.enabled) {
      return;
    }
    const startedAt = this.#dependencies.clock.now();
    await this.#dependencies.unitOfWork.run(() =>
      this.#dependencies.repository.activate(userId, startedAt),
    );
  }
}
