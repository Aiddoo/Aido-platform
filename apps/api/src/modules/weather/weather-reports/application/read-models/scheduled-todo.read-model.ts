/** 날씨와 겹치는지 볼 할 일 한 건. 제목 같은 내용은 읽지 않는다. */
export interface ScheduledTodoReadModel {
  readonly id: number;
  readonly scheduledAt: Temporal.Instant;
}
