// 친구 화면·일별 완료는 PUBLIC만 세서 공개 범위가 바뀌면 그 캐시를 지운다
export class TodoVisibilityChangedEvent {
  readonly eventName = "todo.visibility-changed";

  readonly todoId: number;
  readonly userId: string;

  constructor(todoId: number, userId: string) {
    this.todoId = todoId;
    this.userId = userId;
  }
}
