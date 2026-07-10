import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
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
import { GetDailyCompletionsQuery } from "../get-daily-completions.query";

@QueryHandler(GetDailyCompletionsQuery)
export class GetDailyCompletionsHandler
	implements IQueryHandler<GetDailyCompletionsQuery, DailyCompletionsRange>
{
	constructor(
		@Inject(TODO_COMPLETION_REPOSITORY)
		private readonly repository: TodoCompletionRepositoryPort,
	) {}

	async execute(
		query: GetDailyCompletionsQuery,
	): Promise<DailyCompletionsRange> {
		// 조회 범위를 반열림 구간 [start, end)로 변환 (종료일 포함 위해 +1일)
		const start = parseDateOnly(query.startDate);
		const end = addDays(1, parseDateOnly(query.endDate));

		const aggregates = await this.repository.aggregateByDateRange({
			userId: query.userId,
			startDate: start,
			endDate: end,
		});

		return buildDailyCompletionsRange(aggregates, {
			startDate: query.startDate,
			endDate: query.endDate,
		});
	}
}
