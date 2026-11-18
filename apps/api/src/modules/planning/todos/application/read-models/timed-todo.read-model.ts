/** 날씨와 겹치는지 볼, 아직 하지 않았고 시각이 정해진 할 일 한 건 */
export interface TimedTodoReadModel {
  readonly id: number;
  readonly userId: string;
  readonly title: string;
  /** 그날의 할 일 시각. 전날부터 이어지는 여러 날 할 일은 그날의 벽시계 시각이다 */
  readonly scheduledAt: Temporal.Instant;
}
