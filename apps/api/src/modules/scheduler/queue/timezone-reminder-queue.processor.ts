import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";

import type { TimezoneAwareReminderJob } from "../jobs/timezone-aware-reminder.job";
import {
	type ReminderHourChangedJobData,
	TIMEZONE_REMINDER_QUEUE,
	TimezoneReminderJobName,
} from "./timezone-reminder-queue.constants";

/** 모든 timezone-reminder 잡 데이터 유니온 */
export type TimezoneReminderJobData =
	| Record<string, never>
	| ReminderHourChangedJobData;

/**
 * 타임존 리마인더 BullMQ Processor
 *
 * BullMQ Job Scheduler가 매분 생성하는 잡을 처리합니다.
 * - sweep-reminders: TimezoneAwareReminderJob.handleHourlySweep()
 * - reminder-hour-changed: TimezoneAwareReminderJob.handleReminderHourChanged()
 */
@Processor(TIMEZONE_REMINDER_QUEUE)
export class TimezoneReminderProcessor extends WorkerHost {
	readonly #logger = new Logger(TimezoneReminderProcessor.name);

	/** @see TimezoneAwareReminderJob — 순환 참조 방지를 위해 setter injection */
	#reminderJob?: TimezoneAwareReminderJob;
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

	async process(job: Job<TimezoneReminderJobData>): Promise<void> {
		if (!this.#reminderJob) {
			throw new Error("TimezoneAwareReminderJob not initialized");
		}

		switch (job.name) {
			case TimezoneReminderJobName.SWEEP_REMINDERS:
				this.#logger.debug("Processing timezone reminder sweep...");
				await this.#reminderJob.handleHourlySweep();
				break;
			case TimezoneReminderJobName.REMINDER_HOUR_CHANGED:
				this.#logger.debug(
					`Processing reminder hour changed: userId=${(job.data as ReminderHourChangedJobData).userId}`,
				);
				await this.#reminderJob.handleReminderHourChanged(
					job.data as ReminderHourChangedJobData,
				);
				break;
			default:
				this.#logger.warn(`Unknown job name: ${job.name}`);
		}
	}
}
