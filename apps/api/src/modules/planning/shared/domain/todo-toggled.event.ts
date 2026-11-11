/**
 * Todo 완료 상태 토글 도메인 이벤트
 *
 * 리마인더 취소는 같은 트랜잭션에서, 스트릭 갱신(양방향)·친구 완료 알림·마일스톤(완료 시)은
 * ApplyTodoCompletionEffectsUseCase가 커밋 뒤 처리합니다.
 */
export class TodoToggledEvent {
  readonly eventName = "todo.toggled";

  readonly todoId: number;
  readonly userId: string;
  readonly completed: boolean;
  readonly timezone: string;

  constructor(todoId: number, userId: string, completed: boolean, timezone: string) {
    this.todoId = todoId;
    this.userId = userId;
    this.completed = completed;
    this.timezone = timezone;
  }
}
