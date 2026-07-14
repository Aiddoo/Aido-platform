import { Inject, Injectable } from "@nestjs/common";
import {
	RETENTION_REPOSITORY,
	type RetentionRepositoryPort,
} from "../../ports/retention.repository.port";
import {
	RETENTION_CONFIG,
	type RetentionConfigPort,
} from "../../ports/retention-config.port";

@Injectable()
export class ActivateRetentionExperimentUseCase {
	constructor(
		@Inject(RETENTION_REPOSITORY)
		private readonly repository: RetentionRepositoryPort,
		@Inject(RETENTION_CONFIG)
		private readonly config: RetentionConfigPort,
	) {}

	async execute(userId: string): Promise<void> {
		if (!this.config.enabled) return;
		await this.repository.activate(userId, new Date());
	}
}
