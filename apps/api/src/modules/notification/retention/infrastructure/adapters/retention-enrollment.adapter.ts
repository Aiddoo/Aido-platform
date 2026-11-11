import { Injectable } from "@nestjs/common";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { RetentionEnrollmentPort } from "../../application/ports/retention-enrollment.port.js";
import { ActivateRetentionExperimentUseCase } from "../../application/use-cases/activate-retention-experiment.use-case.js";
import { EnrollRetentionExperimentUseCase } from "../../application/use-cases/enroll-retention-experiment.use-case.js";

// 공개 enrollment 포트를 리텐션 내부 UseCase에 연결한다
@Injectable()
export class RetentionEnrollmentAdapter implements RetentionEnrollmentPort {
  readonly #enrollRetentionExperimentUseCase: EnrollRetentionExperimentUseCase;
  readonly #activateRetentionExperimentUseCase: ActivateRetentionExperimentUseCase;

  constructor(
    enrollRetentionExperimentUseCase: EnrollRetentionExperimentUseCase,
    activateRetentionExperimentUseCase: ActivateRetentionExperimentUseCase,
  ) {
    this.#enrollRetentionExperimentUseCase = enrollRetentionExperimentUseCase;
    this.#activateRetentionExperimentUseCase = activateRetentionExperimentUseCase;
  }

  enrollNewUser(userId: UserId, isActivated: boolean): Promise<void> {
    return this.#enrollRetentionExperimentUseCase.execute(userId.value, isActivated);
  }

  activateNewUser(userId: UserId): Promise<void> {
    return this.#activateRetentionExperimentUseCase.execute(userId.value);
  }
}
