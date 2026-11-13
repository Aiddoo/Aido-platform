import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

/** notification 주간 리마인더가 센 지난주 할 일 수 */
export interface WeeklyAchievementTally {
  readonly userId: UserId;
  readonly year: number;
  readonly week: number;
  readonly totalTodos: number;
  readonly completedTodos: number;
  readonly achievedAt: Temporal.Instant;
}

/** 다른 Context(notification)에 여는 주간 성취 기록 문 */
export abstract class WeeklyAchievementWriterPort {
  abstract record(tallies: readonly WeeklyAchievementTally[]): Promise<void>;
}
