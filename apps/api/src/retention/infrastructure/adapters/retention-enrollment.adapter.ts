import { Injectable } from "@nestjs/common";
import type { RetentionEnrollmentPort } from "../../application/ports/retention-enrollment.port";
import { ActivateRetentionExperimentUseCase } from "../../application/use-cases/activate-retention-experiment/activate-retention-experiment.use-case";
import { EnrollRetentionExperimentUseCase } from "../../application/use-cases/enroll-retention-experiment/enroll-retention-experiment.use-case";

/** 공개 enrollment capability를 리텐션 내부 UseCase에 연결한다. */
@Injectable()
export class RetentionEnrollmentAdapter implements RetentionEnrollmentPort {
	constructor(
		private readonly enrollRetentionExperimentUseCase: EnrollRetentionExperimentUseCase,
		private readonly activateRetentionExperimentUseCase: ActivateRetentionExperimentUseCase,
	) {}

	enrollNewUser(userId: string, isActivated: boolean): Promise<void> {
		return this.enrollRetentionExperimentUseCase.execute(userId, isActivated);
	}

	activateNewUser(userId: string): Promise<void> {
		return this.activateRetentionExperimentUseCase.execute(userId);
	}
}
