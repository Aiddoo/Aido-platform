/** notification 주간 리마인더가 넘기는 지난주 집계 */
export interface WeeklyAchievementRecordInput {
  readonly userId: string;
  readonly year: number;
  readonly week: number;
  readonly totalTodos: number;
  readonly completedTodos: number;
  readonly achievedAt: Temporal.Instant;
}

export interface RecordWeeklyAchievementsCommand {
  readonly records: readonly WeeklyAchievementRecordInput[];
}

/** 다른 Context(notification)에 여는 주간 기록 쓰기 포트 */
export abstract class WeeklyAchievementWriterPort {
  abstract execute(command: RecordWeeklyAchievementsCommand): Promise<void>;
}
