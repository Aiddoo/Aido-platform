import { Inject, Injectable } from "@nestjs/common";
import { addDays } from "@/shared/domain/date/utils/arithmetic";
import { parseDateOnly } from "@/shared/domain/date/utils/parse";
import {
	buildDailyCompletionsRange,
	type DailyCompletionsRange,
} from "../../../domain/daily-completion";
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
 */
@Injectable()
export class GetDailyCompletionsUseCase {
	constructor(
		@Inject(TODO_COMPLETION_REPOSITORY)
		private readonly repository: TodoCompletionRepositoryPort,
	) {}

	async execute(
		input: GetDailyCompletionsInput,
	): Promise<DailyCompletionsRange> {
		// 조회 범위를 반열림 구간 [start, end)로 변환 (종료일 포함 위해 +1일)
		const start = parseDateOnly(input.startDate);
		const end = addDays(1, parseDateOnly(input.endDate));

		const aggregates = await this.repository.aggregateByDateRange({
			userId: input.userId,
			startDate: start,
			endDate: end,
		});

		return buildDailyCompletionsRange(aggregates, {
			startDate: input.startDate,
			endDate: input.endDate,
		});
	}
}
