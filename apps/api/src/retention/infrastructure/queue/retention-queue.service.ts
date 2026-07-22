import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import {
	JOB_RUNTIME,
	type JobRuntimePort,
} from "@/shared/application/ports/job-runtime.port";
import { runInBackground } from "@/shared/infrastructure/bullmq/non-blocking-init";
import type { RetentionJobEnqueuerPort } from "../../application/ports/retention-job-enqueuer.port";
import { RETENTION_QUEUE, RetentionJobName } from "./retention-queue.constants";

@Injectable()
export class RetentionQueueService
	implements RetentionJobEnqueuerPort, OnModuleInit
{
	readonly #logger = new Logger(RetentionQueueService.name);
	schedulerRegistration: Promise<void> = Promise.resolve();

	constructor(@Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort) {}

	onModuleInit(): void {
		this.schedulerRegistration = runInBackground(
			this.#logger,
			"Retention scheduler registration",
			async () => {
				await this.runtime.schedule(
					"retention-stage-sweep-scheduler",
					"0 * * * * *",
					RETENTION_QUEUE,
					{ name: RetentionJobName.STAGE_SWEEP, data: {} },
					this.#jobOptions(),
				);
				await this.runtime.schedule(
					"retention-outbox-relay-scheduler",
					"*/5 * * * * *",
					RETENTION_QUEUE,
					{ name: RetentionJobName.OUTBOX_RELAY, data: {} },
					this.#jobOptions(),
				);
			},
		);
	}

	async enqueueDispatch(outboxId: string): Promise<void> {
		await this.runtime.enqueue(
			RETENTION_QUEUE,
			{ name: RetentionJobName.DISPATCH, data: { outboxId } },
			{
				...this.#jobOptions(),
				jobKey: `retention-push-${outboxId}`,
			},
		);
	}

	#jobOptions() {
		return {
			retryLimit: 4,
			retryDelaySeconds: 1,
			retryBackoff: true,
			expireInSeconds: 5 * 60,
			retentionSeconds: 7 * 24 * 60 * 60,
			deleteAfterSeconds: 24 * 60 * 60,
		};
	}
}
