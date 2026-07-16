/**
 * 주간 달성 집계 조회 포트.
 *
 * 지난 주(월~일) 유저별 전체/완료 투두 수를 타임존 스코프로 집계한다.
 */
import type { UserTodoCount } from "./scheduler-read-models";

export const WEEKLY_ACHIEVEMENT_STATS_READER = Symbol(
	"WEEKLY_ACHIEVEMENT_STATS_READER",
);

/** 주간 집계 범위 파라미터 */
export interface WeeklyStatsParams {
	readonly tz: string;
	readonly periodStart: Date;
	readonly periodEnd: Date;
}

export interface WeeklyAchievementStatsReaderPort {
	/** 유저별 전체 투두 수 (기간·타임존 스코프) */
	groupTotalTodosByUser(params: WeeklyStatsParams): Promise<UserTodoCount[]>;

	/** 유저별 완료 투두 수 (기간·타임존 스코프) */
	groupCompletedTodosByUser(
		params: WeeklyStatsParams,
	): Promise<UserTodoCount[]>;

	/** 주간 달성 푸시 대상인 무료(비구독·비관리자) 사용자 ID */
	findFreeRecipientIds(userIds: string[]): Promise<Set<string>>;
}
