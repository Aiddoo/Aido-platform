import { Inject, Injectable } from "@nestjs/common";
import { addDays } from "@/shared/domain/date/utils/arithmetic";
import { toDateString } from "@/shared/domain/date/utils/format";
import { parseDateOnly } from "@/shared/domain/date/utils/parse";
import {
	buildDailyCompletionsRange,
	type DailyCompletionsRange,
} from "../../../domain/daily-completion";
import {
	DAILY_COMPLETION_CACHE,
	type DailyCompletionCachePort,
} from "../../ports/daily-completion-cache.port";
import {
	TODO_COMPLETION_REPOSITORY,
	type TodoCompletionRepositoryPort,
} from "../../ports/todo-completion.repository.port";

export interface GetDailyCompletionsInput {
	userId: string;
	startDate: string;
	endDate: string;
}

/**
 * 기간별 일일 완료 현황 조회 use-case (캘린더용, 읽기 전용).
 *
 * Cache-aside: 과거일 불변 + 투두 쓰기 이벤트가 무효화하므로 TTL 10분은 백스톱.
 */
@Injectable()
export class GetDailyCompletionsUseCase {
	constructor(
		@Inject(TODO_COMPLETION_REPOSITORY)
		private readonly repository: TodoCompletionRepositoryPort,
		@Inject(DAILY_COMPLETION_CACHE)
		private readonly cache: DailyCompletionCachePort,
	) {}

	async execute(
		input: GetDailyCompletionsInput,
	): Promise<DailyCompletionsRange> {
		const start = parseDateOnly(input.startDate);
		const endInclusive = parseDateOnly(input.endDate);

		// 캐시 키 세그먼트는 파싱된 날짜를 YYYY-MM-DD로 정규화해 사용
		const startKey = toDateString(start);
		const endKey = toDateString(endInclusive);

		const cached = await this.cache.getRange(input.userId, startKey, endKey);
		if (cached !== undefined) {
			return cached;
		}

		// 조회 범위를 반열림 구간 [start, end)로 변환 (종료일 포함 위해 +1일)
		const aggregates = await this.repository.aggregateByDateRange({
			userId: input.userId,
			startDate: start,
			endDate: addDays(1, endInclusive),
		});

		const result = buildDailyCompletionsRange(aggregates, {
			startDate: input.startDate,
			endDate: input.endDate,
		});

		await this.cache.setRange(input.userId, startKey, endKey, result);

		return result;
	}
}
