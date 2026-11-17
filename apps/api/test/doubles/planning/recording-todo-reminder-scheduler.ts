import {
  TodoReminderSchedulerPort,
  type TodoReminderSchedule,
} from "#api/modules/planning/todos/application/ports/todo-reminder-scheduler.port";
import type { TodoId } from "#api/modules/planning/todos/domain/todo-id.vo";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

interface RecordedReminder {
  readonly todoId: number;
  readonly scheduledTime: Temporal.Instant;
  readonly userId: string;
}

// 단언을 짧게 쓰도록 id를 값으로 풀어 기록한다
export class RecordingTodoReminderScheduler extends TodoReminderSchedulerPort {
  readonly scheduled: RecordedReminder[] = [];
  readonly cancelled: number[] = [];
  async scheduleReminder(
    todoId: TodoId,
    scheduledTime: Temporal.Instant,
    userId: UserId,
  ): Promise<void> {
    this.scheduled.push({ todoId: todoId.value, scheduledTime, userId: userId.value });
  }
  async scheduleReminders(reminders: readonly TodoReminderSchedule[]): Promise<void> {
    this.scheduled.push(
      ...reminders.map(({ todoId, scheduledTime, userId }) => ({
        todoId: todoId.value,
        scheduledTime,
        userId: userId.value,
      })),
    );
  }
  async cancelReminders(todoIds: readonly TodoId[]): Promise<void> {
    this.cancelled.push(...todoIds.map((todoId) => todoId.value));
  }
}
