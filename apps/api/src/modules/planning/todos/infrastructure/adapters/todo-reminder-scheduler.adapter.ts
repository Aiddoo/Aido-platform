import { Injectable } from "@nestjs/common";

import { TodoReminderSchedulerPort as NotificationReminderSchedulerPort } from "#api/modules/notification/reminders/notification-reminders.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  TodoReminderSchedulerPort,
  TodoReminderSchedule,
} from "../../application/ports/todo-reminder-scheduler.port.js";
import type { TodoId } from "../../domain/todo-id.vo.js";

/**
 * Todo 리마인더 포트 어댑터 — notification 리마인더 포트에 위임
 */
@Injectable()
export class ReminderSchedulerAdapter implements TodoReminderSchedulerPort {
  readonly #reminderScheduler: NotificationReminderSchedulerPort;

  constructor(reminderScheduler: NotificationReminderSchedulerPort) {
    this.#reminderScheduler = reminderScheduler;
  }

  scheduleReminder(todoId: TodoId, scheduledTime: Temporal.Instant, userId: UserId): Promise<void> {
    return this.#reminderScheduler.scheduleReminder(todoId, scheduledTime, userId);
  }

  scheduleReminders(reminders: readonly TodoReminderSchedule[]): Promise<void> {
    return this.#reminderScheduler.scheduleReminders(reminders);
  }

  cancelReminders(todoIds: readonly TodoId[]): Promise<void> {
    return this.#reminderScheduler.cancelReminders(todoIds);
  }
}
