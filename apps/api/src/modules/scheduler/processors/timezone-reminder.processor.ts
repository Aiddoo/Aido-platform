import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";

import type { TimezoneAwareReminderJob } from "../jobs/timezone-aware-reminder.job";

export const TIMEZONE_REMINDER_QUEUE = "timezone-reminder";

export type TimezoneReminderJobData = Record<string, never>;

/**
 * 타임존 리마인더 BullMQ Processor
 *
 * BullMQ Job Scheduler가 매분 생성하는 잡을 처리합니다.
 * 실제 sweep 로직은 TimezoneAwareReminderJob.handleHourlySweep()에 위임합니다.
 */
@Processor(TIMEZONE_REMINDER_QUEUE)
export class TimezoneReminderProcessor extends WorkerHost {
	readonly #logger = new Logger(TimezoneReminderProcessor.name);

	/** @see TimezoneAwareReminderJob — 순환 참조 방지를 위해 setter injection */
	#reminderJob!: TimezoneAwareReminderJob;
	setReminderJob(job: TimezoneAwareReminderJob) {
		this.#reminderJob = job;
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

	async process(_job: Job<TimezoneReminderJobData>): Promise<void> {
		this.#logger.debug("Processing timezone reminder sweep...");
		await this.#reminderJob.handleHourlySweep();
	}
}
