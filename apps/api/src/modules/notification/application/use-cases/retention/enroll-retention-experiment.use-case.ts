import { assignRetentionVariant } from "../../../domain/services/retention/experiment-assignment.js";
import { type RetentionConfigPort } from "../../ports/retention/retention-config.port.js";
import { type RetentionRepositoryPort } from "../../ports/retention/retention.repository.port.js";

interface EnrollRetentionExperimentDependencies {
  readonly repository: Pick<RetentionRepositoryPort, "enroll">;
  readonly config: Pick<RetentionConfigPort, "enabled" | "treatmentPercent">;
}

export class EnrollRetentionExperiment {
  readonly #dependencies: EnrollRetentionExperimentDependencies;

  constructor(dependencies: EnrollRetentionExperimentDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(userId: string, activated: boolean): Promise<void> {
    if (!this.#dependencies.config.enabled) return;
    await this.#dependencies.repository.enroll({
      userId,
      variant: assignRetentionVariant(userId, this.#dependencies.config.treatmentPercent),
      startedAt: activated ? new Date() : null,
    });
  }
}
