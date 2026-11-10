import { Injectable } from "@nestjs/common";

import type { RetentionEnrollmentPort } from "../../application/ports/retention-enrollment.port.js";
import { ActivateRetentionExperiment } from "../../application/use-cases/activate-retention-experiment.use-case.js";
import { EnrollRetentionExperiment } from "../../application/use-cases/enroll-retention-experiment.use-case.js";

/** 공개 enrollment capability를 리텐션 내부 UseCase에 연결한다. */
@Injectable()
export class RetentionEnrollmentAdapter implements RetentionEnrollmentPort {
  readonly #enrollRetentionExperimentUseCase: EnrollRetentionExperiment;
  readonly #activateRetentionExperimentUseCase: ActivateRetentionExperiment;

  constructor(
    enrollRetentionExperimentUseCase: EnrollRetentionExperiment,
    activateRetentionExperimentUseCase: ActivateRetentionExperiment,
  ) {
    this.#enrollRetentionExperimentUseCase = enrollRetentionExperimentUseCase;
    this.#activateRetentionExperimentUseCase = activateRetentionExperimentUseCase;
  }

  enrollNewUser(userId: string, isActivated: boolean): Promise<void> {
    return this.#enrollRetentionExperimentUseCase.execute(userId, isActivated);
  }

  activateNewUser(userId: string): Promise<void> {
    return this.#activateRetentionExperimentUseCase.execute(userId);
  }
}
