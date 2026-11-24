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
  // 예약 큐에 보낸 묶음마다 할 일 id. 일괄 예약이 문장 수를 줄이는지 본다
  readonly scheduleBatches: number[][] = [];
  async scheduleReminder(
    todoId: TodoId,
    scheduledTime: Temporal.Instant,
    userId: UserId,
  ): Promise<void> {
    this.scheduleBatches.push([todoId.value]);
    this.scheduled.push({ todoId: todoId.value, scheduledTime, userId: userId.value });
  }
  async scheduleReminders(reminders: readonly TodoReminderSchedule[]): Promise<void> {
    this.scheduleBatches.push(reminders.map(({ todoId }) => todoId.value));
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
