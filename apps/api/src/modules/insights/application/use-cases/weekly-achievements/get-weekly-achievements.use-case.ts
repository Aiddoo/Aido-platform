import type { PaginationService } from "#api/shared/application/pagination/index";
import { type CursorPaginationInfo } from "#api/shared/application/pagination/index";
import type { SupportedLocale } from "#api/shared/domain/locale";

import { computeSummary } from "../../../domain/policies/weekly-achievements/weekly-achievement.policy.js";
import type { WeeklyAchievementSummary } from "../../../domain/records/weekly-achievements/weekly-achievement.record.js";
import { type WeeklyAchievementRepositoryPort } from "../../ports/weekly-achievements/weekly-achievement.repository.port.js";
import {
  toWeeklyAchievementView,
  type WeeklyAchievementView,
} from "../../read-models/weekly-achievements/weekly-achievement.read-model.js";

export interface GetWeeklyAchievementsInput {
  readonly userId: string;
  readonly year: number;
  readonly cursor?: number;
  readonly size?: number;
  readonly locale: SupportedLocale;
}

/** 주간 달성 목록 뷰 (아이템 + 커서 페이지네이션 + 연도 요약) */
export interface WeeklyAchievementListView {
  readonly items: WeeklyAchievementView[];
  readonly pagination: CursorPaginationInfo<number>;
  readonly summary: WeeklyAchievementSummary;
}

interface GetWeeklyAchievementsDependencies {
  readonly repository: Pick<WeeklyAchievementRepositoryPort, "findByYear" | "findAllByYear">;
  readonly paginationService: Pick<PaginationService, "normalizeCursorPagination">;
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

    const [items, yearRecords] = await Promise.all([
      this.#dependencies.repository.findByYear(userId, year, cursor, take),
      this.#dependencies.repository.findAllByYear(userId, year),
    ]);

    const hasNext = items.length > size;
    const paginatedItems = hasNext ? items.slice(0, size) : items;
    const lastItem = paginatedItems[paginatedItems.length - 1];

    const pagination: CursorPaginationInfo<number> = {
      nextCursor: hasNext && lastItem !== undefined ? lastItem.week : null,
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
