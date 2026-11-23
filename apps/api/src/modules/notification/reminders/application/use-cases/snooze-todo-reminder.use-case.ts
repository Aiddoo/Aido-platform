import { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { NotificationId } from "../../../notifications/domain/notification-id.vo.js";
import {
  canSnoozeFromNotification,
  snoozedReminderFireAt,
} from "../../domain/reminder-snooze.domain-service.js";
import type { SnoozeNotificationReaderPort } from "../ports/snooze-notification.reader.port.js";
import type { SnoozeTodoReaderPort } from "../ports/snooze-todo.reader.port.js";
import type { TodoReminderSnoozeSchedulerPort } from "../ports/todo-reminder-snooze-scheduler.port.js";
import {
  reminderNotificationNotFound,
  reminderTodoAlreadyCompleted,
  reminderTodoNotFound,
} from "../reminders.errors.js";
import { ReminderLogEvent } from "../reminders.log-events.js";

export interface SnoozeTodoReminderCommand {
  readonly userId: string;
  readonly todoId: number;
  readonly notificationId: number;
}

export interface TodoReminderSnooze {
  readonly remindAt: Temporal.Instant;
}

export interface SnoozeTodoReminderDependencies {
  readonly todoReader: Pick<SnoozeTodoReaderPort, "findTodo">;
  readonly notificationReader: Pick<SnoozeNotificationReaderPort, "findNotification">;
  readonly snoozeScheduler: Pick<TodoReminderSnoozeSchedulerPort, "scheduleSnooze">;
  readonly clock: Pick<ClockPort, "now">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class SnoozeTodoReminderUseCase {
  readonly #dependencies: SnoozeTodoReminderDependencies;

  constructor(dependencies: SnoozeTodoReminderDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: SnoozeTodoReminderCommand): Promise<TodoReminderSnooze> {
    const { todoReader, notificationReader, snoozeScheduler, clock, logger } = this.#dependencies;
    const userId = UserId.reconstitute(command.userId);
    const todoId = TodoId.reconstitute(command.todoId);
    const notificationId = NotificationId.reconstitute(command.notificationId);
    const now = clock.now();

    // 서로 다른 slice의 읽기라 함께 보낸다
    const [todo, notification] = await Promise.all([
      todoReader.findTodo(todoId),
      notificationReader.findNotification(notificationId),
    ]);
    if (todo == null || !todo.ownerId.equals(userId)) {
      throw reminderTodoNotFound(todoId);
    }
    if (notification == null || !canSnoozeFromNotification({ notification, userId, todoId, now })) {
      throw reminderNotificationNotFound(notificationId);
    }
    if (todo.completed) {
      throw reminderTodoAlreadyCompleted(todoId);
    }

    const booking = await snoozeScheduler.scheduleSnooze({
      todoId,
      userId,
      notificationId,
      remindAt: snoozedReminderFireAt(now),
    });
    logger.log({
      event: ReminderLogEvent.TODO_REMINDER_SNOOZE_SCHEDULED,
      todoId: command.todoId,
      userId: command.userId,
      notificationId: command.notificationId,
      isScheduled: booking.isNew,
    });
    return { remindAt: booking.remindAt };
  }
}
