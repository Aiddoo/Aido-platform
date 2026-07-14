import { Inject, Injectable, Logger } from "@nestjs/common";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import {
	RETENTION_REPOSITORY,
	type RetentionRepositoryPort,
} from "../../ports/retention.repository.port";
import {
	RETENTION_CONFIG,
	type RetentionConfigPort,
} from "../../ports/retention-config.port";
import {
	RETENTION_JOB_ENQUEUER,
	type RetentionJobEnqueuerPort,
} from "../../ports/retention-job-enqueuer.port";

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
		const cutoff = new Date(now.getTime() - 2 * 60 * 1000);
		const claimed = await this.uow.run(async () => {
			await this.repository.recoverStaleOutboxes(cutoff);
			return this.repository.claimOutboxes(100, now);
		});

		for (const outbox of claimed) {
			try {
				await this.enqueuer.enqueueDispatch(outbox.id);
				await this.repository.markOutboxPublished(outbox.id);
			} catch (error) {
				const delay = Math.min(15 * 60_000, 1000 * 2 ** outbox.attempts);
				await this.repository.markOutboxFailed({
					outboxId: outbox.id,
					attempts: outbox.attempts,
					error: error instanceof Error ? error.message : String(error),
					nextAttemptAt: new Date(Date.now() + delay),
				});
				this.#logger.error(`Retention outbox publish failed: id=${outbox.id}`);
			}
		}
	}
}
