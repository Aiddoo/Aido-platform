import { Inject, Injectable } from "@nestjs/common";

import { RETENTION_CONFIG, type RetentionConfigPort } from "../../ports/retention-config.port";
import {
	RETENTION_PUSH_SENDER,
	type RetentionPushSenderPort,
} from "../../ports/retention-push-sender.port";
import {
	RETENTION_REPOSITORY,
	type RetentionRepositoryPort,
} from "../../ports/retention.repository.port";

@Injectable()
export class DispatchRetentionPushUseCase {
	constructor(
		@Inject(RETENTION_REPOSITORY)
		private readonly repository: RetentionRepositoryPort,
		@Inject(RETENTION_PUSH_SENDER)
		private readonly sender: RetentionPushSenderPort,
		@Inject(RETENTION_CONFIG)
		private readonly config: RetentionConfigPort,
	) {}

	async execute(outboxId: string): Promise<void> {
		if (!this.config.enabled) {
			await this.repository.deferOutbox(outboxId, new Date(Date.now() + 60_000));
			return;
		}
		const candidate = await this.repository.claimDispatch(outboxId);
		if (!candidate) return;
		try {
			if (!(await this.sender.canSend(candidate, new Date()))) {
				await this.repository.markDispatchSkipped(candidate.dispatchId, "INELIGIBLE_AT_DISPATCH");
				return;
			}
			const results = await this.sender.send(candidate);
			await this.repository.recordDeliveryResults(candidate.dispatchId, results);
		} catch (error) {
			await this.repository.releaseDispatch(
				candidate.dispatchId,
				error instanceof Error ? error.message : String(error),
			);
			throw error;
		}
	}
}
