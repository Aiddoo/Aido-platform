import { Inject, Injectable } from "@nestjs/common";
import {
	type CursorPaginationInfo,
	PaginationService,
} from "@/shared/application/pagination";
import {
	computeSummary,
	toWeeklyAchievementView,
	type WeekLabelLocale,
	type WeeklyAchievementSummary,
	type WeeklyAchievementView,
} from "../../../domain/weekly-achievement";
import {
	WEEKLY_ACHIEVEMENT_REPOSITORY,
	type WeeklyAchievementRepositoryPort,
} from "../../ports/weekly-achievement.repository.port";

export interface GetWeeklyAchievementsInput {
	userId: string;
	year: number;
	cursor: number | undefined;
	size: number | undefined;
	locale: WeekLabelLocale;
}

/** 주간 달성 목록 뷰 (아이템 + 커서 페이지네이션 + 연도 요약) */
export interface WeeklyAchievementListView {
	items: WeeklyAchievementView[];
	pagination: CursorPaginationInfo<number>;
	summary: WeeklyAchievementSummary;
}

/**
 * 연도별 주간 달성 목록 조회 use-case (커서 페이지네이션 + summary, 읽기 전용).
 */
@Injectable()
export class GetWeeklyAchievementsUseCase {
	constructor(
		@Inject(WEEKLY_ACHIEVEMENT_REPOSITORY)
		private readonly repository: WeeklyAchievementRepositoryPort,
		private readonly paginationService: PaginationService,
	) {}

	async execute(
		input: GetWeeklyAchievementsInput,
	): Promise<WeeklyAchievementListView> {
		const { userId, year, locale } = input;

		const { cursor, size, take } =
			this.paginationService.normalizeCursorPagination<number>({
				cursor: input.cursor,
				size: input.size,
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
