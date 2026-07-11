import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";

import { TimezoneAwareReminderOrchestrator } from "../../application/services/timezone-aware-reminder.orchestrator";
import {
	TIMEZONE_REMINDER_QUEUE,
	type TimezoneReminderJob,
	TimezoneReminderJobName,
} from "./timezone-reminder-queue.constants";

/**
 * 타임존 리마인더 BullMQ Processor (진입 어댑터).
 *
 * BullMQ Job Scheduler가 매분 생성하는 잡을 받아 오케스트레이터에 위임한다.
 * - sweep-reminders: 매분 스윕
 * - reminder-hour-changed: 리마인더 시간 변경 catch-up
 * - social-digest: 저녁 리마인더 30분 후 소셜 다이제스트
 *
 * 오케스트레이터를 생성자 주입하므로(무버스·무setter) DIP를 지키며,
 * 판별 유니온으로 job.data를 캐스트 없이 좁힌다.
 */
@Processor(TIMEZONE_REMINDER_QUEUE)
export class TimezoneReminderProcessor extends WorkerHost {
	readonly #logger = new Logger(TimezoneReminderProcessor.name);

	constructor(
		private readonly orchestrator: TimezoneAwareReminderOrchestrator,
	) {
		super();
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

	async process(job: TimezoneReminderJob): Promise<void> {
		switch (job.name) {
			case TimezoneReminderJobName.SWEEP_REMINDERS:
				this.#logger.debug("Processing timezone reminder sweep...");
				await this.orchestrator.handleMinuteSweep();
				break;
			case TimezoneReminderJobName.REMINDER_HOUR_CHANGED:
				this.#logger.debug(
					`Processing reminder hour changed: userId=${job.data.userId}`,
				);
				await this.orchestrator.handleReminderHourChanged(job.data);
				break;
			case TimezoneReminderJobName.SOCIAL_DIGEST:
				this.#logger.debug(`Processing social digest: tz=${job.data.timezone}`);
				await this.orchestrator.handleSocialDigest(job.data);
				break;
			default: {
				const _exhaustive: never = job;
				void _exhaustive;
			}
		}
	}
}
