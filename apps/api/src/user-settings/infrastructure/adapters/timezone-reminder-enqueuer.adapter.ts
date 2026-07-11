import { Injectable } from "@nestjs/common";

import { TimezoneReminderQueueService } from "@/scheduler/queue";

import type {
	ReminderHourChangedPayload,
	ReminderScheduleEnqueuerPort,
} from "../../application/ports/reminder-schedule.enqueuer.port";

/**
 * 리마인더 스케줄 즉시 반영 어댑터.
 *
 * scheduler의 큐 발송 심(`@/scheduler/queue`)으로 위임한다.
 * heavy 배럴을 피해 scheduler ↔ user-settings 순환을 방지한다.
 */
@Injectable()
export class TimezoneReminderEnqueuerAdapter
	implements ReminderScheduleEnqueuerPort
{
	constructor(
		private readonly timezoneReminderQueueService: TimezoneReminderQueueService,
	) {}

	enqueueReminderHourChanged(payload: ReminderHourChangedPayload): void {
		this.timezoneReminderQueueService.enqueueReminderHourChanged(payload);
	}
}
