import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { DispatchRetentionPushUseCase } from "../../application/use-cases/dispatch-retention-push/dispatch-retention-push.use-case";
import { ProcessRetentionStagesUseCase } from "../../application/use-cases/process-retention-stages/process-retention-stages.use-case";
import { RelayRetentionOutboxUseCase } from "../../application/use-cases/relay-retention-outbox/relay-retention-outbox.use-case";
import {
	RETENTION_QUEUE,
	type RetentionJobMap,
	RetentionJobName,
} from "./retention-queue.constants";

type RetentionJob = {
	[K in keyof RetentionJobMap]: Job<RetentionJobMap[K], unknown, K>;
}[keyof RetentionJobMap];

@Processor(RETENTION_QUEUE)
export class RetentionQueueProcessor extends WorkerHost {
	readonly #logger = new Logger(RetentionQueueProcessor.name);

	constructor(
		private readonly processStages: ProcessRetentionStagesUseCase,
		private readonly relayOutbox: RelayRetentionOutboxUseCase,
		private readonly dispatchPush: DispatchRetentionPushUseCase,
	) {
		super();
	}

	async process(job: RetentionJob): Promise<void> {
		switch (job.name) {
			case RetentionJobName.STAGE_SWEEP:
				await this.processStages.execute();
				break;
			case RetentionJobName.OUTBOX_RELAY:
				await this.relayOutbox.execute();
				break;
			case RetentionJobName.DISPATCH:
				await this.dispatchPush.execute(job.data.outboxId);
				break;
			default: {
				const exhaustive: never = job;
				void exhaustive;
			}
		}
	}

	@OnWorkerEvent("failed")
	onFailed(job: Job | undefined, error: Error): void {
		this.#logger.error(
			`Retention job failed: id=${job?.id}, name=${job?.name}, error=${error.message}`,
			error.stack,
		);
	}
}
