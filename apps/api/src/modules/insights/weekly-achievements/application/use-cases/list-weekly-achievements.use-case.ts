import { clampPageSize, toCursorPage } from "#api/shared/application/cursor-page";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { summarizeWeeklyAchievements } from "../../domain/weekly-achievement.domain-service.js";
import type { WeeklyAchievementRepositoryPort } from "../ports/weekly-achievement.repository.port.js";
import type { WeeklyAchievementList } from "../read-models/weekly-achievement-list.read-model.js";

export interface ListWeeklyAchievementsQuery {
  readonly userId: string;
  readonly year: number;
  readonly cursor?: number;
  readonly size?: number;
}

export interface ListWeeklyAchievementsDependencies {
  readonly weeklyAchievementRepository: Pick<
    WeeklyAchievementRepositoryPort,
    "listByYear" | "listAllByYear"
  >;
}

export class ListWeeklyAchievementsUseCase {
  readonly #dependencies: ListWeeklyAchievementsDependencies;

  constructor(dependencies: ListWeeklyAchievementsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: ListWeeklyAchievementsQuery): Promise<WeeklyAchievementList> {
    const { weeklyAchievementRepository } = this.#dependencies;
    const userId = UserId.reconstitute(query.userId);
    const size = clampPageSize(query.size);

    const [rows, yearAchievements] = await Promise.all([
      weeklyAchievementRepository.listByYear({
        userId,
        year: query.year,
        afterWeek: query.cursor ?? null,
        limit: size + 1,
      }),
      weeklyAchievementRepository.listAllByYear({ userId, year: query.year }),
    ]);

    return {
      page: toCursorPage({ rows, size, toCursor: (achievement) => achievement.isoWeek.week }),
      summary: summarizeWeeklyAchievements(yearAchievements),
    };
  }
}
