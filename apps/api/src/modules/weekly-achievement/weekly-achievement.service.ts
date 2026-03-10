import { Injectable, Logger } from "@nestjs/common";

import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import type { CursorPaginationInfo } from "@/common/pagination";
import { PaginationService } from "@/common/pagination";
import type {
	GetWeeklyAchievementParams,
	GetWeeklyAchievementsParams,
	UpsertWeeklyAchievementParams,
} from "./types/weekly-achievement.types";
import { WeeklyAchievementMapper } from "./weekly-achievement.mapper";
import { WeeklyAchievementRepository } from "./weekly-achievement.repository";

type WeeklyAchievementDto = ReturnType<
	typeof WeeklyAchievementMapper.toResponse
>;

export interface WeeklyAchievementListResult {
	items: WeeklyAchievementDto[];
	pagination: CursorPaginationInfo<number>;
	summary: {
		totalWeeks: number;
		perfectWeeks: number;
		currentStreak: number;
		bestStreak: number;
		averageRate: number;
	};
}

@Injectable()
export class WeeklyAchievementService {
	readonly #logger = new Logger(WeeklyAchievementService.name);

	constructor(
		private readonly weeklyAchievementRepository: WeeklyAchievementRepository,
		private readonly paginationService: PaginationService,
	) {}

	/**
	 * 연도별 주간 달성 목록을 조회합니다 (커서 페이지네이션 + summary).
	 */
	async getWeeklyAchievements(
		params: GetWeeklyAchievementsParams,
	): Promise<WeeklyAchievementListResult> {
		const { userId, year } = params;

		const { cursor, size, take } =
			this.paginationService.normalizeCursorPagination<number>({
				cursor: params.cursor,
				size: params.size,
			});

		// 페이지네이션 목록 + 연도 전체 기록 (summary 계산용) 병렬 조회
		const [items, yearRecords] = await Promise.all([
			this.weeklyAchievementRepository.findByYear(userId, year, cursor, take),
			this.weeklyAchievementRepository.findAllByYear(userId, year),
		]);

		const hasNext = items.length > size;
		const paginatedItems = hasNext ? items.slice(0, size) : items;
		const lastItem = paginatedItems[paginatedItems.length - 1];

		const pagination: CursorPaginationInfo<number> = {
			nextCursor: hasNext && lastItem ? lastItem.week : null,
			hasNext,
			size,
		};

		const summary = WeeklyAchievementMapper.computeSummary(yearRecords);

		this.#logger.debug(
			`Weekly achievements: user=${userId}, year=${year}, items=${paginatedItems.length}, total=${yearRecords.length}`,
		);

		return {
			items: paginatedItems.map((e) => WeeklyAchievementMapper.toResponse(e)),
			pagination,
			summary,
		};
	}

	/**
	 * 특정 주차의 달성 상세를 조회합니다.
	 */
	async getWeeklyAchievement(
		params: GetWeeklyAchievementParams,
	): Promise<WeeklyAchievementDto> {
		const { userId, year, week } = params;

		const entity = await this.weeklyAchievementRepository.findByYearAndWeek(
			userId,
			year,
			week,
		);

		if (!entity) {
			throw BusinessExceptions.weeklyAchievementNotFound(year, week);
		}

		return WeeklyAchievementMapper.toResponse(entity);
	}

	/**
	 * 여러 주간 달성 기록을 일괄 upsert합니다 (Strategy에서 호출).
	 */
	async upsertMany(paramsList: UpsertWeeklyAchievementParams[]): Promise<void> {
		return this.weeklyAchievementRepository.upsertMany(paramsList);
	}
}
