/**
 * DailyCompletion 모듈의 타입 정의
 *
 * 이 파일은 DailyCompletion 모듈에서 사용되는 모든 인터페이스를 포함합니다.
 */

// ============================================================================
// Service 인터페이스
// ============================================================================

/**
 * 기간별 일일 완료율 조회 파라미터
 */
export interface GetDailyCompletionsRangeParams {
	userId: string;
	startDate: string;
	endDate: string;
}

/**
 * 일일 완료 요약 정보
 */
export interface DailyCompletionSummary {
	date: string;
	totalTodos: number;
	completedTodos: number;
	isComplete: boolean;
	completionRate: number;
}

/**
 * 기간별 일일 완료율 조회 결과
 */
export interface DailyCompletionsRangeResult {
	completions: DailyCompletionSummary[];
	totalCompleteDays: number;
	dateRange: {
		startDate: string;
		endDate: string;
	};
}

// ============================================================================
// Repository 인터페이스
// ============================================================================

/**
 * 날짜 범위로 투두 조회 파라미터
 */
export interface FindTodosByDateRangeParams {
	userId: string;
	startDate: Date;
	endDate: Date;
}

/**
 * 날짜별 투두 집계 결과
 */
export interface TodoAggregateByDate {
	date: Date;
	total: number;
	completed: number;
}
