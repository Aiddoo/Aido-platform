import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export interface WeeklyAchievementTally {
  readonly userId: UserId;
  readonly year: number;
  readonly week: number;
  readonly totalTodos: number;
  readonly completedTodos: number;
  readonly achievedAt: Temporal.PlainDate;
}

// 주간 달성 기록은 insights가 소유한다. 이 slice는 집계한 값을 넘기기만 한다
export abstract class WeeklyAchievementWriterPort {
  abstract execute(input: { readonly records: readonly WeeklyAchievementTally[] }): Promise<void>;
}
