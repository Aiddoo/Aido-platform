import { Inject, Injectable } from "@nestjs/common";

import {
  type IReminderScheduler,
  TodoReminderSchedulerPort as NotificationReminderSchedulerPort,
} from "#api/modules/notification/notification-reminders.public";

import type {
  TodoReminderSchedulerPort,
  TodoReminderSchedule,
} from "../../application/ports/todo-reminder-scheduler.port.js";

/**
 * Todo 리마인더 포트 어댑터 — scheduler의 IReminderScheduler에 위임
 */
@Injectable()
export class ReminderSchedulerAdapter implements TodoReminderSchedulerPort {
  readonly #reminderScheduler: IReminderScheduler;

  constructor(
    @Inject(NotificationReminderSchedulerPort)
    reminderScheduler: IReminderScheduler,
  ) {
    this.#reminderScheduler = reminderScheduler;
  }

  scheduleReminder(todoId: number, scheduledTime: Temporal.Instant, userId: string): Promise<void> {
    return this.#reminderScheduler.scheduleReminder(todoId, scheduledTime, userId);
  }

  scheduleReminders(reminders: readonly TodoReminderSchedule[]): Promise<void> {
    return this.#reminderScheduler.scheduleReminders(reminders);
  }

  cancelReminders(todoIds: readonly number[]): Promise<void> {
    return this.#reminderScheduler.cancelReminders(todoIds);
  }
}
