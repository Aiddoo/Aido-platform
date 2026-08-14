import { Inject, Injectable } from "@nestjs/common";

import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";

import { RETENTION_CONFIG, type RetentionConfigPort } from "../../ports/retention-config.port";
import {
	RETENTION_REPOSITORY,
	type RetentionRepositoryPort,
} from "../../ports/retention.repository.port";

@Injectable()
export class ActivateRetentionExperimentUseCase {
	constructor(
		@Inject(RETENTION_REPOSITORY)
		private readonly repository: RetentionRepositoryPort,
		@Inject(RETENTION_CONFIG)
		private readonly config: RetentionConfigPort,
		@Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWorkPort,
	) {}

	async execute(userId: string): Promise<void> {
		if (!this.config.enabled) return;
		await this.unitOfWork.run(() => this.repository.activate(userId, new Date()));
	}
}
