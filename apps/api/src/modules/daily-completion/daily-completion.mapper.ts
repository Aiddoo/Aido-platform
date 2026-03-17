import { toDateString } from "@/common/date/utils/format";
import type {
	DailyCompletionSummary,
	TodoAggregateByDate,
} from "./types/daily-completion.types";

/**
 * DailyCompletion 도메인의 Mapper 클래스
 *
 * Todo 집계 데이터를 일일 완료 요약 정보로 변환합니다.
 */
export abstract class DailyCompletionMapper {
	/**
	 * Todo 집계 데이터를 일일 완료 요약 정보로 변환합니다.
	 *
	 * @param aggregates - 날짜별 Todo 집계 데이터
	 * @returns 변환된 일일 완료 요약 배열 (날짜순 정렬)
	 */
	static toCompletionSummaries(
		aggregates: TodoAggregateByDate[],
	): DailyCompletionSummary[] {
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
}
