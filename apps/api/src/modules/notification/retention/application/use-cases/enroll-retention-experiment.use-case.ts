import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { RETENTION_EXPERIMENT_KEY } from "../../domain/retention.constants.js";
import type { ExperimentAssignerPort } from "../ports/experiment-assigner.port.js";
import type { RetentionConfigPort } from "../ports/retention-config.port.js";
import type { RetentionRepositoryPort } from "../ports/retention.repository.port.js";

interface EnrollRetentionExperimentDependencies {
  readonly repository: Pick<RetentionRepositoryPort, "enroll">;
  readonly config: Pick<RetentionConfigPort, "enabled" | "treatmentPercent">;
  readonly experimentAssigner: ExperimentAssignerPort;
  readonly clock: ClockPort;
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
    const { treatmentPercent } = this.#dependencies.config;
    const variant = this.#dependencies.experimentAssigner.assign({
      experimentKey: RETENTION_EXPERIMENT_KEY,
      subjectId: userId,
      // 처리군이 앞 구간을 차지한다(1.15.0까지의 배정 함수와 같은 순서)
      variants: [
        { key: "TREATMENT", weight: treatmentPercent },
        { key: "CONTROL", weight: 100 - treatmentPercent },
      ],
    });
    await this.#dependencies.repository.enroll({
      userId: UserId.reconstitute(userId),
      variant,
      startedAt: activated ? this.#dependencies.clock.now() : null,
    });
  }
}
