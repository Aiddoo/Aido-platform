import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { IsoWeek } from "../../domain/iso-week.vo.js";
import type { WeeklyAchievement } from "../../domain/weekly-achievement.entity.js";
import type { WeeklyAchievementRepositoryPort } from "../ports/weekly-achievement.repository.port.js";
import { weeklyAchievementNotFound } from "../weekly-achievements.errors.js";

export interface GetWeeklyAchievementQuery {
  readonly userId: string;
  readonly year: number;
  readonly week: number;
}

export interface GetWeeklyAchievementDependencies {
  readonly weeklyAchievementRepository: Pick<WeeklyAchievementRepositoryPort, "findByWeek">;
}

export class GetWeeklyAchievementUseCase {
  readonly #dependencies: GetWeeklyAchievementDependencies;

  constructor(dependencies: GetWeeklyAchievementDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetWeeklyAchievementQuery): Promise<WeeklyAchievement> {
    const isoWeek = IsoWeek.create(query.year, query.week);
    const achievement = await this.#dependencies.weeklyAchievementRepository.findByWeek({
      userId: UserId.reconstitute(query.userId),
      isoWeek,
    });
    if (achievement == null) {
      throw weeklyAchievementNotFound(isoWeek);
    }
    return achievement;
  }
}
