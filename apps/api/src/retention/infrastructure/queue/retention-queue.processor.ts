import {
	Inject,
	Injectable,
	Logger,
	type OnModuleInit,
	Optional,
} from "@nestjs/common";
import {
	JOB_RUNTIME,
	type JobData,
	type JobRuntimePort,
} from "@/shared/application/ports/job-runtime.port";
import {
	fromLegacyJob,
	type NamedJob,
} from "@/shared/infrastructure/jobs/named-job";
import { DispatchRetentionPushUseCase } from "../../application/use-cases/dispatch-retention-push/dispatch-retention-push.use-case";
import { ProcessRetentionStagesUseCase } from "../../application/use-cases/process-retention-stages/process-retention-stages.use-case";
import { RelayRetentionOutboxUseCase } from "../../application/use-cases/relay-retention-outbox/relay-retention-outbox.use-case";
import {
	RETENTION_LEGACY_QUEUE,
	RETENTION_QUEUE,
	type RetentionJobMap,
	RetentionJobName,
} from "./retention-queue.constants";

type RetentionJob = NamedJob<RetentionJobMap>;

@Injectable()
export class RetentionQueueProcessor implements OnModuleInit {
	readonly #logger = new Logger(RetentionQueueProcessor.name);

	constructor(
		private readonly processStages: ProcessRetentionStagesUseCase,
		private readonly relayOutbox: RelayRetentionOutboxUseCase,
		private readonly dispatchPush: DispatchRetentionPushUseCase,
		@Optional()
		@Inject(JOB_RUNTIME)
		private readonly runtime?: JobRuntimePort,
	) {}

	async onModuleInit(): Promise<void> {
		if (!this.runtime) return;
		await this.runtime.work<RetentionJob>(
			RETENTION_QUEUE,
			async (jobs) => {
				for (const job of jobs) await this.process(job.data);
			},
			{ teamSize: 1, pollingIntervalSeconds: 2 },
		);
		await this.runtime.work<JobData>(
			RETENTION_LEGACY_QUEUE,
			async (jobs) => {
				for (const job of jobs) {
					await this.process(fromLegacyJob<RetentionJobMap>(job));
				}
			},
			{ teamSize: 1, pollingIntervalSeconds: 2 },
		);
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

	onFailed(
		job: { readonly id?: string; readonly name?: string } | undefined,
		error: Error,
	): void {
		this.#logger.error(
			`Retention job failed: id=${job?.id}, name=${job?.name}, error=${error.message}`,
			error.stack,
		);
	}
}
