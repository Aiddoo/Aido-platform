/** 특정 날짜의 투두 완료 현황 */
export interface TodoCompletionStats {
	total: number;
	completed: number;
}

/**
 * 투두 완료 통계 리더 포트.
 *
 * 스트릭 갱신 시 특정 날짜의 투두 총계/완료 수를 조회한다.
 * (todo 모듈 순환을 피하기 위해 어댑터가 직접 집계 쿼리로 위임)
 */
export interface TodoCompletionStatsReaderPort {
	/** [dayStart, dayEnd) 구간의 total/completed 카운트 */
	countForDay(userId: string, dayStart: Date, dayEnd: Date): Promise<TodoCompletionStats>;
}

export const TODO_COMPLETION_STATS_READER = Symbol("TODO_COMPLETION_STATS_READER");
