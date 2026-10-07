import { Injectable } from "@nestjs/common";

import type { RetentionEnrollmentPort } from "../../../application/ports/retention/retention-enrollment.port.js";
import { ActivateRetentionExperiment } from "../../../application/use-cases/retention/activate-retention-experiment.use-case.js";
import { EnrollRetentionExperiment } from "../../../application/use-cases/retention/enroll-retention-experiment.use-case.js";

/** 공개 enrollment capability를 리텐션 내부 UseCase에 연결한다. */
@Injectable()
export class RetentionEnrollmentAdapter implements RetentionEnrollmentPort {
  constructor(
    private readonly enrollRetentionExperimentUseCase: EnrollRetentionExperiment,
    private readonly activateRetentionExperimentUseCase: ActivateRetentionExperiment,
  ) {}

  enrollNewUser(userId: string, isActivated: boolean): Promise<void> {
    return this.enrollRetentionExperimentUseCase.execute(userId, isActivated);
  }

  activateNewUser(userId: string): Promise<void> {
    return this.activateRetentionExperimentUseCase.execute(userId);
  }
}
