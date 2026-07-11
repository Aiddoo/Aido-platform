import { Injectable } from "@nestjs/common";

import { TimezoneReminderQueueService } from "@/scheduler/queue/timezone-reminder-queue.service";

import type {
	ReminderHourChangedPayload,
	ReminderScheduleEnqueuerPort,
} from "../../application/ports/reminder-schedule.enqueuer.port";

/**
 * 리마인더 스케줄 즉시 반영 어댑터.
 *
 * scheduler의 TimezoneReminderQueueService로 위임한다(미이관 모듈 — 딥 임포트).
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
