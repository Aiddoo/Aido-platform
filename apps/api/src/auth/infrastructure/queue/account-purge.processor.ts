import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";

import type { AccountPurgeJob } from "@/auth/infrastructure/scheduler/account-purge.job";

export const ACCOUNT_PURGE_QUEUE = "account-purge";

export type AccountPurgeJobData = Record<string, never>;

/**
 * 계정 정리 BullMQ Processor
 *
 * BullMQ Job Scheduler가 매일 KST 03:00에 생성하는 잡을 처리합니다.
 * 실제 로직은 AccountPurgeJob.purgeDeletedAccounts()에 위임합니다.
 */
@Processor(ACCOUNT_PURGE_QUEUE)
export class AccountPurgeProcessor extends WorkerHost {
	readonly #logger = new Logger(AccountPurgeProcessor.name);

	/** @see AccountPurgeJob — 순환 참조 방지를 위해 setter injection */
	#purgeJob!: AccountPurgeJob;
	setPurgeJob(job: AccountPurgeJob) {
		this.#purgeJob = job;
	}

	@OnWorkerEvent("stalled")
	onStalled(jobId: string) {
		this.#logger.warn(`Job stalled: jobId=${jobId}`);
	}

	@OnWorkerEvent("error")
	onError(error: Error) {
		this.#logger.error(`Worker error: ${error.message}`, error.stack);
	}

	@OnWorkerEvent("failed")
	onFailed(job: Job | undefined, error: Error) {
		this.#logger.error(
			`Job failed: jobId=${job?.id}, name=${job?.name}, error=${error.message}`,
			error.stack,
		);
	}

	async process(_job: Job<AccountPurgeJobData>): Promise<void> {
		this.#logger.debug("Processing account purge job...");
		await this.#purgeJob.purgeDeletedAccounts();
	}
}
