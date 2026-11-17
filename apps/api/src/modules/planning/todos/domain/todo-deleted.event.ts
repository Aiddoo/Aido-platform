export class TodoDeletedEvent {
  readonly eventName = "todo.deleted";

  readonly todoId: number;
  readonly userId: string;

  constructor(todoId: number, userId: string) {
    this.todoId = todoId;
    this.userId = userId;
  }
}
