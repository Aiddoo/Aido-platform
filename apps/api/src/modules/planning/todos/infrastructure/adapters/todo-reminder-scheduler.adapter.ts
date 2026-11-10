import { Inject, Injectable } from "@nestjs/common";

import {
  type IReminderScheduler,
  REMINDER_SCHEDULER,
} from "#api/modules/notification/notification-reminders.public";

import type {
  TodoReminderPort,
  TodoReminderSchedule,
} from "../../application/ports/todo-reminder-scheduler.port.js";

/**
 * Todo 리마인더 포트 어댑터 — scheduler의 IReminderScheduler에 위임
 */
@Injectable()
export class TodoReminderAdapter implements TodoReminderPort {
  readonly #reminderScheduler: IReminderScheduler;

  constructor(
    @Inject(REMINDER_SCHEDULER)
    reminderScheduler: IReminderScheduler,
  ) {
    this.#reminderScheduler = reminderScheduler;
  }

  scheduleReminder(todoId: number, scheduledTime: Date, userId: string): Promise<void> {
    return this.#reminderScheduler.scheduleReminder(todoId, scheduledTime, userId);
  }

  scheduleReminders(reminders: readonly TodoReminderSchedule[]): Promise<void> {
    return this.#reminderScheduler.scheduleReminders(reminders);
  }

  cancelReminders(todoIds: readonly number[]): Promise<void> {
    return this.#reminderScheduler.cancelReminders(todoIds);
  }
}
