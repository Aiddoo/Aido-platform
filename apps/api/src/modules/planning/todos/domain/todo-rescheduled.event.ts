// scheduledTime이 있으면 리마인더를 다시 잡고 null이면 지운다
export class TodoRescheduledEvent {
  readonly eventName = "todo.rescheduled";

  readonly todoId: number;
  readonly userId: string;
  readonly scheduledTime: Temporal.Instant | null;

  constructor(todoId: number, userId: string, scheduledTime: Temporal.Instant | null) {
    this.todoId = todoId;
    this.userId = userId;
    this.scheduledTime = scheduledTime;
  }
}
