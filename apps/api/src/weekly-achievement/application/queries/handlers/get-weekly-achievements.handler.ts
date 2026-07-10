import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import {
	type CursorPaginationInfo,
	PaginationService,
} from "@/shared/application/pagination";
import {
	computeSummary,
	toWeeklyAchievementView,
} from "../../../domain/weekly-achievement";
import {
	WEEKLY_ACHIEVEMENT_REPOSITORY,
	type WeeklyAchievementRepositoryPort,
} from "../../ports/weekly-achievement.repository.port";
import {
	GetWeeklyAchievementsQuery,
	type WeeklyAchievementListView,
} from "../get-weekly-achievements.query";

@QueryHandler(GetWeeklyAchievementsQuery)
export class GetWeeklyAchievementsHandler
	implements
		IQueryHandler<GetWeeklyAchievementsQuery, WeeklyAchievementListView>
{
	constructor(
		@Inject(WEEKLY_ACHIEVEMENT_REPOSITORY)
		private readonly repository: WeeklyAchievementRepositoryPort,
		private readonly paginationService: PaginationService,
	) {}

	async execute(
		query: GetWeeklyAchievementsQuery,
	): Promise<WeeklyAchievementListView> {
		const { userId, year, locale } = query;

		const { cursor, size, take } =
			this.paginationService.normalizeCursorPagination<number>({
				cursor: query.cursor,
				size: query.size,
			});

		// 페이지네이션 목록 + 연도 전체 기록(summary 계산용) 병렬 조회 (waterfall 제거)
		const [items, yearRecords] = await Promise.all([
			this.repository.findByYear(userId, year, cursor, take),
			this.repository.findAllByYear(userId, year),
		]);

		const hasNext = items.length > size;
		const paginatedItems = hasNext ? items.slice(0, size) : items;
		const lastItem = paginatedItems[paginatedItems.length - 1];

		const pagination: CursorPaginationInfo<number> = {
			nextCursor: hasNext && lastItem ? lastItem.week : null,
			hasNext,
			size,
		};

		return {
			items: paginatedItems.map((row) => toWeeklyAchievementView(row, locale)),
			pagination,
			summary: computeSummary(yearRecords),
		};
	}
}
