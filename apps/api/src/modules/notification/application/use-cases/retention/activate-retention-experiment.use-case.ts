import { type UnitOfWorkPort } from "#api/shared/application/ports/index";

import { type RetentionConfigPort } from "../../ports/retention/retention-config.port.js";
import { type RetentionRepositoryPort } from "../../ports/retention/retention.repository.port.js";

interface ActivateRetentionExperimentDependencies {
  readonly repository: Pick<RetentionRepositoryPort, "activate">;
  readonly config: Pick<RetentionConfigPort, "enabled">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
}

export class ActivateRetentionExperiment {
  readonly #dependencies: ActivateRetentionExperimentDependencies;

  constructor(dependencies: ActivateRetentionExperimentDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(userId: string): Promise<void> {
    if (!this.#dependencies.config.enabled) return;
    await this.#dependencies.unitOfWork.run(() =>
      this.#dependencies.repository.activate(userId, new Date()),
    );
  }
}
