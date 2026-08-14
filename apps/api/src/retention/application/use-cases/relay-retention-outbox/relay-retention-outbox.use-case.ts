import { Inject, Injectable, Logger } from "@nestjs/common";

import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";

import { decideRetentionOutboxRetry } from "../../policies/retention-outbox-retry.policy";
import { RETENTION_CONFIG, type RetentionConfigPort } from "../../ports/retention-config.port";
import {
	RETENTION_JOB_ENQUEUER,
	type RetentionJobEnqueuerPort,
} from "../../ports/retention-job-enqueuer.port";
import {
	RETENTION_REPOSITORY,
	type RetentionRepositoryPort,
} from "../../ports/retention.repository.port";

const OUTBOX_RELAY_BATCH_SIZE = 25;
const OUTBOX_PROCESSING_LEASE_MS = 2 * 60_000;

@Injectable()
export class RelayRetentionOutboxUseCase {
	readonly #logger = new Logger(RelayRetentionOutboxUseCase.name);

	constructor(
		@Inject(RETENTION_REPOSITORY)
		private readonly repository: RetentionRepositoryPort,
		@Inject(RETENTION_JOB_ENQUEUER)
		private readonly enqueuer: RetentionJobEnqueuerPort,
		@Inject(RETENTION_CONFIG)
		private readonly config: RetentionConfigPort,
		@Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
	) {}

	async execute(): Promise<void> {
		if (!this.config.enabled) return;
		const now = new Date();
		const cutoff = new Date(now.getTime() - OUTBOX_PROCESSING_LEASE_MS);
		const claimed = await this.uow.run(async () => {
			await this.repository.recoverStaleOutboxes(cutoff);
			return this.repository.claimOutboxes(OUTBOX_RELAY_BATCH_SIZE, now);
		});

		await Promise.all(
			claimed.map(async (outbox) => {
				try {
					await this.enqueuer.enqueueDispatch(outbox.id);
					await this.repository.markOutboxPublished(outbox.id);
				} catch (error) {
					const normalizedError = error instanceof Error ? error : new Error(String(error));
					const retryDecision = decideRetentionOutboxRetry(outbox.attempts);
					await this.repository.markOutboxFailed({
						outboxId: outbox.id,
						hasExhaustedRetries: retryDecision.hasExhaustedRetries,
						error: normalizedError.message,
						nextAttemptAt: new Date(Date.now() + retryDecision.delayMs),
					});
					this.#logger.error(
						`Retention outbox publish failed: id=${outbox.id}`,
						normalizedError.stack,
					);
				}
			}),
		);
	}
}
