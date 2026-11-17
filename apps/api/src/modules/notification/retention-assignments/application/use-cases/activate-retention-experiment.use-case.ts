import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { RetentionAssignmentRepositoryPort } from "../ports/retention-assignment.repository.port.js";
import type { RetentionConfigPort } from "../ports/retention-config.port.js";

interface ActivateRetentionExperimentDependencies {
  readonly repository: Pick<RetentionAssignmentRepositoryPort, "activate">;
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
      this.#dependencies.repository.activate(UserId.reconstitute(userId), startedAt),
    );
  }
}
