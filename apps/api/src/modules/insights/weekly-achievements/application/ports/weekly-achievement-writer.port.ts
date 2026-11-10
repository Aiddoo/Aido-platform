/** notification 주간 리마인더가 넘기는 지난주 집계. achievedAt은 그 배치의 Date를 그대로 받는다 */
export interface WeeklyAchievementRecordInput {
  readonly userId: string;
  readonly year: number;
  readonly week: number;
  readonly totalTodos: number;
  readonly completedTodos: number;
  readonly achievedAt: Date;
}

export interface RecordWeeklyAchievementsCommand {
  readonly records: readonly WeeklyAchievementRecordInput[];
}

/** 다른 Context(notification)에 여는 주간 기록 쓰기 포트 */
export abstract class WeeklyAchievementWriterPort {
  abstract execute(command: RecordWeeklyAchievementsCommand): Promise<void>;
}

/** 옛 토큰. notification이 클래스 토큰으로 옮길 때까지 같은 인스턴스를 가리키는 별칭이다 */
export const WEEKLY_ACHIEVEMENT_WRITER = Symbol("WEEKLY_ACHIEVEMENT_WRITER");
