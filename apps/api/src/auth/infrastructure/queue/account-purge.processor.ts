import {
	Inject,
	Injectable,
	Logger,
	type OnModuleInit,
	Optional,
} from "@nestjs/common";
import type { AccountPurgeJob } from "@/auth/infrastructure/scheduler/account-purge.job";
import {
	JOB_RUNTIME,
	type JobData,
	type JobRuntimePort,
} from "@/shared/application/ports/job-runtime.port";

export const ACCOUNT_PURGE_QUEUE = "account-purge.v1";
export const ACCOUNT_PURGE_LEGACY_QUEUE = "account-purge";
export const ACCOUNT_PURGE_JOB_NAME = "purge-accounts";

export type AccountPurgeJobData = Record<string, never>;

/**
 * 계정 정리 BullMQ Processor
 *
 * BullMQ Job Scheduler가 매일 KST 03:00에 생성하는 잡을 처리합니다.
 * 실제 로직은 AccountPurgeJob.purgeDeletedAccounts()에 위임합니다.
 */
@Injectable()
export class AccountPurgeProcessor implements OnModuleInit {
	readonly #logger = new Logger(AccountPurgeProcessor.name);

	/** @see AccountPurgeJob — 순환 참조 방지를 위해 setter injection */
	#purgeJob?: AccountPurgeJob;
	setPurgeJob(job: AccountPurgeJob) {
		this.#purgeJob = job;
	}

	constructor(
		@Optional()
		@Inject(JOB_RUNTIME)
		private readonly runtime?: JobRuntimePort,
	) {}

	async onModuleInit(): Promise<void> {
		if (!this.runtime) return;
		const handler = async () => this.process();
		await this.runtime.work<JobData>(ACCOUNT_PURGE_QUEUE, handler, {
			teamSize: 1,
			pollingIntervalSeconds: 2,
		});
		await this.runtime.work<JobData>(ACCOUNT_PURGE_LEGACY_QUEUE, handler, {
			teamSize: 1,
			pollingIntervalSeconds: 2,
		});
	}

	onFailed(
		job: { readonly id?: string; readonly name?: string } | undefined,
		error: Error,
	) {
		this.#logger.error(
			`Job failed: jobId=${job?.id}, name=${job?.name}, error=${error.message}`,
			error.stack,
		);
	}

	async process(_job?: { readonly data?: AccountPurgeJobData }): Promise<void> {
		this.#logger.debug("Processing account purge job...");
		if (!this.#purgeJob) {
			throw new Error("AccountPurgeJob not wired (setPurgeJob 미호출)");
		}
		await this.#purgeJob.purgeDeletedAccounts();
	}
}
