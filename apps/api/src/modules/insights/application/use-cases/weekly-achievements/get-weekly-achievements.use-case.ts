import type { PaginationService } from "#api/shared/application/pagination/index";
import { type CursorPaginationInfo } from "#api/shared/application/pagination/index";

import {
  computeSummary,
  toWeeklyAchievementView,
  type WeekLabelLocale,
  type WeeklyAchievementSummary,
  type WeeklyAchievementView,
} from "../../../domain/policies/weekly-achievements/weekly-achievement.js";
import { type WeeklyAchievementRepositoryPort } from "../../ports/weekly-achievements/weekly-achievement.repository.port.js";

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

interface GetWeeklyAchievementsDependencies {
  readonly repository: WeeklyAchievementRepositoryPort;
  readonly paginationService: PaginationService;
}

export class GetWeeklyAchievements {
  readonly #dependencies: GetWeeklyAchievementsDependencies;

  constructor(dependencies: GetWeeklyAchievementsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetWeeklyAchievementsInput): Promise<WeeklyAchievementListView> {
    const { userId, year, locale } = input;

    const { cursor, size, take } =
      this.#dependencies.paginationService.normalizeCursorPagination<number>({
        cursor: input.cursor,
        size: input.size,
      });

    // 페이지네이션 목록 + 연도 전체 기록(summary 계산용) 병렬 조회 (waterfall 제거)
    const [items, yearRecords] = await Promise.all([
      this.#dependencies.repository.findByYear(userId, year, cursor, take),
      this.#dependencies.repository.findAllByYear(userId, year),
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
