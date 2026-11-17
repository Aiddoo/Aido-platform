// 리마인더 취소(ApplyTodoEvents)와 스트릭·친구 완료 알림·마일스톤(ApplyTodoCompletionEffects)이 같은 트랜잭션에서 처리한다
export class TodoToggledEvent {
  readonly eventName = "todo.toggled";

  readonly todoId: number;
  readonly userId: string;
  readonly completed: boolean;
  readonly timezone: string;

  constructor(params: {
    readonly todoId: number;
    readonly userId: string;
    readonly completed: boolean;
    readonly timezone: string;
  }) {
    this.todoId = params.todoId;
    this.userId = params.userId;
    this.completed = params.completed;
    this.timezone = params.timezone;
  }
}
