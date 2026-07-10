import { Inject, Injectable } from "@nestjs/common";
import {
	type IReminderScheduler,
	REMINDER_SCHEDULER,
} from "../../../scheduler/reminder/interfaces/reminder-scheduler.interface";
import type { TodoReminderPort } from "../../application/ports/todo-reminder.port";

/**
 * Todo 리마인더 포트 어댑터 — scheduler의 IReminderScheduler에 위임
 */
@Injectable()
export class TodoReminderAdapter implements TodoReminderPort {
	constructor(
		@Inject(REMINDER_SCHEDULER)
		private readonly reminderScheduler: IReminderScheduler,
	) {}

	scheduleReminder(todoId: number, scheduledTime: Date, userId: string): void {
		this.reminderScheduler.scheduleReminder(todoId, scheduledTime, userId);
	}

	cancelReminder(todoId: number): void {
		this.reminderScheduler.cancelReminder(todoId);
	}
}
