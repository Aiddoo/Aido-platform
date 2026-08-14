import { toDateString } from "@/shared/domain/date/utils/format";

/**
 * 날짜별 Todo 집계 (인프라가 DB에서 집계한 읽기 모델 입력)
 */
export interface TodoAggregateByDate {
	date: Date;
	total: number;
	completed: number;
	categoryColors: string[];
}

/**
 * 일일 완료 요약 (도메인이 규칙으로 계산한 값)
 */
export interface DailyCompletionSummary {
	date: string;
	totalTodos: number;
	completedTodos: number;
	isComplete: boolean;
	completionRate: number;
	categoryColors: string[];
}

/**
 * 기간별 일일 완료 현황 결과
 */
export interface DailyCompletionsRange {
	completions: DailyCompletionSummary[];
	totalCompleteDays: number;
	dateRange: { startDate: string; endDate: string };
}

/**
 * 날짜별 집계를 일일 완료 요약으로 변환한다 (날짜 오름차순).
 *
 * 도메인 규칙: 완료일(isComplete) = 할 일이 1개 이상이고 전부 완료된 날,
 * 완료율(completionRate) = round(완료/전체 × 100).
 */
export function toSummaries(aggregates: TodoAggregateByDate[]): DailyCompletionSummary[] {
	return aggregates
		.map(({ date, total, completed, categoryColors }) => ({
			date: toDateString(date),
			totalTodos: total,
			completedTodos: completed,
			isComplete: total > 0 && total === completed,
			completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
			categoryColors,
		}))
		.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 집계와 조회 범위로부터 완료 현황 결과를 조립한다.
 * (완료일 수 = isComplete인 요약의 개수)
 */
export function buildDailyCompletionsRange(
	aggregates: TodoAggregateByDate[],
	dateRange: { startDate: string; endDate: string },
): DailyCompletionsRange {
	const completions = toSummaries(aggregates);
	const totalCompleteDays = completions.filter((summary) => summary.isComplete).length;

	return { completions, totalCompleteDays, dateRange };
}
