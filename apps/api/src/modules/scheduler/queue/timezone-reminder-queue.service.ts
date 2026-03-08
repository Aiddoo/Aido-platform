import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import type { Queue } from "bullmq";

import {
	type ReminderHourChangedJobData,
	type SocialDigestJobData,
	TIMEZONE_REMINDER_QUEUE,
	type TimezoneReminderJobData,
	TimezoneReminderJobName,
} from "./timezone-reminder-queue.constants";

@Injectable()
export class TimezoneReminderQueueService {
	readonly #logger = new Logger(TimezoneReminderQueueService.name);

	constructor(
		@InjectQueue(TIMEZONE_REMINDER_QUEUE)
		private readonly queue: Queue<TimezoneReminderJobData>,
	) {}

	/**
	 * 매분 sweep 스케줄러 등록 (upsert — 멱등)
	 */
	async registerSweepScheduler(): Promise<void> {
		await this.queue.upsertJobScheduler(
			"tz-reminder-sweep-scheduler",
			{ pattern: "* * * * *" },
			{
				name: TimezoneReminderJobName.SWEEP_REMINDERS,
				data: {} as TimezoneReminderJobData,
			},
		);
		this.#logger.log("Timezone reminder sweep scheduler registered");
	}

	/**
	 * 리마인더 시간 변경 catch-up 잡 등록
	 */
	enqueueReminderHourChanged(payload: ReminderHourChangedJobData): void {
		this.#enqueueAsync(
			TimezoneReminderJobName.REMINDER_HOUR_CHANGED,
			payload,
		).catch((error) => {
			this.#logger.error(
				`Failed to enqueue reminder-hour-changed: userId=${payload.userId}, ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		});
	}

	/**
	 * Social Digest delayed job 등록 (저녁 리마인더 30분 후)
	 */
	enqueueSocialDigest(payload: SocialDigestJobData): void {
		const DELAY_MS = 30 * 60 * 1000; // 30분
		this.queue
			.add(TimezoneReminderJobName.SOCIAL_DIGEST, payload, {
				delay: DELAY_MS,
				removeOnComplete: true,
				removeOnFail: 100,
			})
			.then(() => {
				this.#logger.debug(
					`Social digest job enqueued: tz=${payload.timezone}, delay=30min`,
				);
			})
			.catch((error) => {
				this.#logger.error(
					`Failed to enqueue social-digest: tz=${payload.timezone}, ${error}`,
					error instanceof Error ? error.stack : undefined,
				);
			});
	}

	async #enqueueAsync(
		name: string,
		data: ReminderHourChangedJobData,
	): Promise<void> {
		await this.queue.add(name, data);
		this.#logger.debug(`Job enqueued: name=${name}`);
	}
}
