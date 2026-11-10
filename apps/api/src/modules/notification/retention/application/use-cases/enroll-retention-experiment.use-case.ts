import { now } from "#api/shared/domain/date/utils/core";

import { assignRetentionVariant } from "../../domain/experiment-assignment.domain-service.js";
import { type RetentionConfigPort } from "../ports/retention-config.port.js";
import { type RetentionRepositoryPort } from "../ports/retention.repository.port.js";

interface EnrollRetentionExperimentDependencies {
  readonly repository: Pick<RetentionRepositoryPort, "enroll">;
  readonly config: Pick<RetentionConfigPort, "enabled" | "treatmentPercent">;
}

export class EnrollRetentionExperimentUseCase {
  readonly #dependencies: EnrollRetentionExperimentDependencies;

  constructor(dependencies: EnrollRetentionExperimentDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(userId: string, activated: boolean): Promise<void> {
    if (!this.#dependencies.config.enabled) {
      return;
    }
    await this.#dependencies.repository.enroll({
      userId,
      variant: assignRetentionVariant(userId, this.#dependencies.config.treatmentPercent),
      startedAt: activated ? now() : null,
    });
  }
}
