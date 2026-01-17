import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

import { DATE_FORMAT } from "@/common";
import type { TodoAggregateByDate } from "./daily-completion.repository";
import type { DailyCompletionSummary } from "./daily-completion.service";

dayjs.extend(utc);

/**
 * Todo 집계 데이터를 일일 완료 요약 정보로 변환합니다.
 *
 * @param aggregates - 날짜별 Todo 집계 데이터
 * @returns 변환된 일일 완료 요약 배열 (날짜순 정렬)
 */
export function mapToCompletionSummaries(
	aggregates: TodoAggregateByDate[],
): DailyCompletionSummary[] {
	return aggregates
		.map(({ date, total, completed }) => ({
			date: dayjs.utc(date).format(DATE_FORMAT.DATE_ONLY),
			totalTodos: total,
			completedTodos: completed,
			isComplete: total > 0 && total === completed,
			completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
		}))
		.sort((a, b) => a.date.localeCompare(b.date));
}
