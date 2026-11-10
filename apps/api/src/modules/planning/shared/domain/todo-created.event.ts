/**
 * Todo 생성 도메인 이벤트
 *
 * 리마인더 스케줄링 등 생성 부수효과의 트리거로 사용됩니다.
 */
export class TodoCreatedEvent {
  readonly eventName = "todo.created";

  readonly todoId: number;
  readonly userId: string;
  readonly scheduledTime: Date | null;

  constructor(todoId: number, userId: string, scheduledTime: Date | null) {
    this.todoId = todoId;
    this.userId = userId;
    this.scheduledTime = scheduledTime;
  }
}
