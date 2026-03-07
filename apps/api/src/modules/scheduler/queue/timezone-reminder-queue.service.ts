import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import type { Queue } from "bullmq";

import {
	type ReminderHourChangedJobData,
	TIMEZONE_REMINDER_QUEUE,
	TimezoneReminderJobName,
} from "./timezone-reminder-queue.constants";

// =============================================================================
// Service
// =============================================================================

/**
 * Timezone Reminder BullMQ 큐 서비스
 *
 * 리마인더 시간 변경 catch-up 잡을 큐에 등록합니다.
 * Fire-and-forget 패턴으로 큐 등록 실패 시 로깅만 수행합니다.
 */
@Injectable()
export class TimezoneReminderQueueService {
	readonly #logger = new Logger(TimezoneReminderQueueService.name);

	constructor(
		@InjectQueue(TIMEZONE_REMINDER_QUEUE)
		private readonly queue: Queue<ReminderHourChangedJobData>,
	) {}

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

	// =========================================================================
	// Private
	// =========================================================================

	async #enqueueAsync(
		name: string,
		data: ReminderHourChangedJobData,
	): Promise<void> {
		await this.queue.add(name, data);
		this.#logger.debug(`Job enqueued: name=${name}`);
	}
}
