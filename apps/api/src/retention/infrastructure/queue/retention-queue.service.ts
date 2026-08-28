import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { JOB_RUNTIME, type JobRuntimePort } from "@/shared/application/ports/job-runtime.port";
import { runInBackground } from "@/shared/infrastructure/bullmq/non-blocking-init";

import type { RetentionJobEnqueuerPort } from "../../application/ports/retention-job-enqueuer.port";
import type { ClaimedOutbox } from "../../application/ports/retention.repository.port";
import {
	RETENTION_DISPATCH_JOB_POLICY,
	RETENTION_JOB_POLICY,
	RETENTION_QUEUE,
	RetentionJobName,
} from "./retention-queue.constants";

@Injectable()
export class RetentionQueueService implements RetentionJobEnqueuerPort, OnModuleInit {
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
					RETENTION_JOB_POLICY,
				);
				await this.runtime.schedule(
					"retention-outbox-relay-scheduler",
					"* * * * *",
					RETENTION_QUEUE,
					{ name: RetentionJobName.OUTBOX_RELAY, data: {} },
					RETENTION_JOB_POLICY,
				);
			},
		);
	}

	async enqueueDispatch(outbox: ClaimedOutbox): Promise<void> {
		await this.runtime.enqueue(
			RETENTION_QUEUE,
			{
				name: RetentionJobName.DISPATCH,
				data: { outboxId: outbox.id, publishAttempt: outbox.attempts },
			},
			{
				...RETENTION_DISPATCH_JOB_POLICY,
				idempotencyKey: `retention-push-${outbox.id}-${outbox.attempts}`,
			},
		);
	}
}
