import type { UserTodoCount } from "../read-models/scheduler.read-model.js";

/** [periodStart, periodEnd) 로컬 날짜 범위 */
export interface WeeklyStatsParams {
  readonly timezones: readonly string[];
  readonly periodStart: Temporal.PlainDate;
  readonly periodEnd: Temporal.PlainDate;
}

// 여러 날 할 일은 기간 안의 날마다 하나로 센다(planning 날짜 겹침 규칙과 같다)
export abstract class WeeklyAchievementStatsReaderPort {
  abstract groupTotalTodosByUser(params: WeeklyStatsParams): Promise<UserTodoCount[]>;
  abstract groupCompletedTodosByUser(params: WeeklyStatsParams): Promise<UserTodoCount[]>;
  /** 주간 달성 푸시 대상인 무료(비구독·비관리자) 사용자 ID */
  abstract findFreeRecipientIds(userIds: string[]): Promise<Set<string>>;
}
