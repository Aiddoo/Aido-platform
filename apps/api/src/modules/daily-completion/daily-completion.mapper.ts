import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

import { DATE_FORMAT } from "@/common/date";
import type {
	DailyCompletionSummary,
	TodoAggregateByDate,
} from "./types/daily-completion.types";

dayjs.extend(utc);

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
			.map(({ date, total, completed }) => ({
				date: dayjs.utc(date).format(DATE_FORMAT.DATE_ONLY),
				totalTodos: total,
				completedTodos: completed,
				isComplete: total > 0 && total === completed,
				completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
			}))
			.sort((a, b) => a.date.localeCompare(b.date));
	}
}
