import {
  TodoReminderSchedulerPort,
  type TodoReminderSchedule,
} from "#api/modules/planning/todos/application/ports/todo-reminder-scheduler.port";

export class RecordingTodoReminderScheduler extends TodoReminderSchedulerPort {
  readonly scheduled: TodoReminderSchedule[] = [];
  readonly cancelled: number[] = [];
  async scheduleReminder(
    todoId: number,
    scheduledTime: Temporal.Instant,
    userId: string,
  ): Promise<void> {
    this.scheduled.push({ todoId, scheduledTime, userId });
  }
  async scheduleReminders(reminders: readonly TodoReminderSchedule[]): Promise<void> {
    this.scheduled.push(...reminders);
  }
  async cancelReminders(todoIds: readonly number[]): Promise<void> {
    this.cancelled.push(...todoIds);
  }
}
