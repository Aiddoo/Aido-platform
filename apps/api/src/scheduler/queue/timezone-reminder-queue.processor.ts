import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { type Job, UnrecoverableError } from "bullmq";

import type { TimezoneAwareReminderJob } from "../jobs/timezone-aware-reminder.job";
import {
	type ReminderHourChangedJobData,
	type SocialDigestJobData,
	TIMEZONE_REMINDER_QUEUE,
	type TimezoneReminderJobData,
	TimezoneReminderJobName,
} from "./timezone-reminder-queue.constants";

/**
 * 타임존 리마인더 BullMQ Processor
 *
 * BullMQ Job Scheduler가 매분 생성하는 잡을 처리합니다.
 * - sweep-reminders: TimezoneAwareReminderJob.handleMinuteSweep()
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
			// 영구 실패: 의존성이 주입되지 않은 상태는 재시도해도 해결되지 않음.
			// BullMQ UnrecoverableError 로 즉시 failed set 으로 이동시켜 재시도 루프 방지.
			this.#logger.error("TimezoneAwareReminderJob not initialized");
			throw new UnrecoverableError("TimezoneAwareReminderJob not initialized");
		}

		switch (job.name) {
			case TimezoneReminderJobName.SWEEP_REMINDERS:
				this.#logger.debug("Processing timezone reminder sweep...");
				await this.#reminderJob.handleMinuteSweep();
				break;
			case TimezoneReminderJobName.REMINDER_HOUR_CHANGED:
				this.#logger.debug(
					`Processing reminder hour changed: userId=${(job.data as ReminderHourChangedJobData).userId}`,
				);
				await this.#reminderJob.handleReminderHourChanged(
					job.data as ReminderHourChangedJobData,
				);
				break;
			case TimezoneReminderJobName.SOCIAL_DIGEST:
				this.#logger.debug(
					`Processing social digest: tz=${(job.data as SocialDigestJobData).timezone}`,
				);
				await this.#reminderJob.handleSocialDigest(
					job.data as SocialDigestJobData,
				);
				break;
			default:
				this.#logger.warn(`Unknown job name: ${job.name}`);
		}
	}
}
