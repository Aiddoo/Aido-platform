import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { RetentionAssignmentId } from "../../domain/retention-assignment-id.vo.js";
import { RetentionAssignment } from "../../domain/retention-assignment.aggregate.js";
import { RETENTION_EXPERIMENT_KEY } from "../../domain/retention-assignments.constants.js";
import type { ExperimentAssignerPort } from "../ports/experiment-assigner.port.js";
import type { RetentionAssignmentRepositoryPort } from "../ports/retention-assignment.repository.port.js";
import type { RetentionConfigPort } from "../ports/retention-config.port.js";

interface EnrollRetentionExperimentDependencies {
  readonly repository: Pick<RetentionAssignmentRepositoryPort, "save">;
  readonly config: Pick<RetentionConfigPort, "enabled" | "treatmentPercent">;
  readonly experimentAssigner: ExperimentAssignerPort;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
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
    const subjectId = UserId.reconstitute(userId);
    const variant = this.#dependencies.experimentAssigner.assign({
      experimentKey: RETENTION_EXPERIMENT_KEY,
      subjectId,
      // 처리군이 앞 구간을 차지한다(1.15.0까지의 배정 함수와 같은 순서)
      variants: [
        { key: "TREATMENT", weight: treatmentPercent },
        { key: "CONTROL", weight: 100 - treatmentPercent },
      ],
    });
    const assignment = RetentionAssignment.create({
      id: RetentionAssignmentId.generate(),
      userId: subjectId,
      variant,
      startedAt: activated ? this.#dependencies.clock.now() : null,
    });
    // 이미 배정된 사용자면 저장이 false이고 시작하지 않은 배정도 그대로 둔다
    await this.#dependencies.unitOfWork.run(() => this.#dependencies.repository.save(assignment));
  }
}
