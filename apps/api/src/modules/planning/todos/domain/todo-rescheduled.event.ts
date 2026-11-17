/**
 * Todo 일정 변경 도메인 이벤트
 *
 * 일정 변경(PATCH /todos/:id/schedule) 완료 시 발행됩니다.
 * scheduledTime이 있으면 리마인더 재스케줄, null이면 취소 부수효과가 동작합니다.
 */
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
