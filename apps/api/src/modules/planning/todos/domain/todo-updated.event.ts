// completed는 바뀐 뒤의 완료 상태다. 완료면 리마인더를 지운다(완료 사실은 todo.toggled가 따로 낸다)
export class TodoUpdatedEvent {
  readonly eventName = "todo.updated";

  readonly todoId: number;
  readonly userId: string;
  readonly completed: boolean;

  constructor(todoId: number, userId: string, completed: boolean) {
    this.todoId = todoId;
    this.userId = userId;
    this.completed = completed;
  }
}
