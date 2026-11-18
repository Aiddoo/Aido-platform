export class TodoCreatedEvent {
  readonly eventName = "todo.created";

  readonly todoId: number;
  readonly userId: string;
  readonly scheduledTime: Temporal.Instant | null;

  constructor(todoId: number, userId: string, scheduledTime: Temporal.Instant | null) {
    this.todoId = todoId;
    this.userId = userId;
    this.scheduledTime = scheduledTime;
  }
}
