import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type { Queue } from "bullmq";
import { runInBackground } from "@/shared/infrastructure/bullmq/non-blocking-init";
import type { RetentionJobEnqueuerPort } from "../../application/ports/retention-job-enqueuer.port";
import {
	RETENTION_QUEUE,
	type RetentionJobData,
	RetentionJobName,
} from "./retention-queue.constants";

@Injectable()
export class RetentionQueueService
	implements RetentionJobEnqueuerPort, OnModuleInit
{
	readonly #logger = new Logger(RetentionQueueService.name);
	schedulerRegistration: Promise<void> = Promise.resolve();

	constructor(
		@InjectQueue(RETENTION_QUEUE)
		private readonly queue: Queue<RetentionJobData>,
	) {}

	onModuleInit(): void {
		this.schedulerRegistration = runInBackground(
			this.#logger,
			"Retention scheduler registration",
			async () => {
				await this.queue.upsertJobScheduler(
					"retention-stage-sweep-scheduler",
					{ every: 60_000 },
					{ name: RetentionJobName.STAGE_SWEEP, data: {} },
				);
				await this.queue.upsertJobScheduler(
					"retention-outbox-relay-scheduler",
					{ every: 5_000 },
					{ name: RetentionJobName.OUTBOX_RELAY, data: {} },
				);
			},
		);
	}

	async enqueueDispatch(outboxId: string): Promise<void> {
		await this.queue.add(
			RetentionJobName.DISPATCH,
			{ outboxId },
			{
				jobId: `retention-push-${outboxId}`,
				attempts: 5,
				backoff: { type: "exponential", delay: 1_000 },
				removeOnComplete: { age: 24 * 60 * 60, count: 10_000 },
				removeOnFail: { age: 7 * 24 * 60 * 60, count: 50_000 },
			},
		);
	}
}
