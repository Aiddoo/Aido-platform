import { Inject, Injectable } from "@nestjs/common";

import { assignRetentionVariant } from "../../../domain/services/experiment-assignment";
import { RETENTION_CONFIG, type RetentionConfigPort } from "../../ports/retention-config.port";
import {
	RETENTION_REPOSITORY,
	type RetentionRepositoryPort,
} from "../../ports/retention.repository.port";

@Injectable()
export class EnrollRetentionExperimentUseCase {
	constructor(
		@Inject(RETENTION_REPOSITORY)
		private readonly repository: RetentionRepositoryPort,
		@Inject(RETENTION_CONFIG)
		private readonly config: RetentionConfigPort,
	) {}

	async execute(userId: string, activated: boolean): Promise<void> {
		if (!this.config.enabled) return;
		await this.repository.enroll({
			userId,
			variant: assignRetentionVariant(userId, this.config.treatmentPercent),
			startedAt: activated ? new Date() : null,
		});
	}
}
