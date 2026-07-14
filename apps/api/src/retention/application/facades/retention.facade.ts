import { Injectable } from "@nestjs/common";
import { ActivateRetentionExperimentUseCase } from "../use-cases/activate-retention-experiment/activate-retention-experiment.use-case";
import { EnrollRetentionExperimentUseCase } from "../use-cases/enroll-retention-experiment/enroll-retention-experiment.use-case";

@Injectable()
export class RetentionFacade {
	constructor(
		private readonly enrollUseCase: EnrollRetentionExperimentUseCase,
		private readonly activateUseCase: ActivateRetentionExperimentUseCase,
	) {}

	enrollNewUser(userId: string, activated: boolean): Promise<void> {
		return this.enrollUseCase.execute(userId, activated);
	}

	activateNewUser(userId: string): Promise<void> {
		return this.activateUseCase.execute(userId);
	}
}
