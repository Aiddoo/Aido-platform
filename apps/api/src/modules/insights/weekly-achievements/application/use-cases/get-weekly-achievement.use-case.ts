import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { SupportedLocale } from "#api/shared/domain/locale";

import { type WeeklyAchievementRepositoryPort } from "../ports/weekly-achievement.repository.port.js";
import {
  toWeeklyAchievementView,
  type WeeklyAchievementView,
} from "../read-models/weekly-achievement.read-model.js";

export interface GetWeeklyAchievementQuery {
  readonly userId: string;
  readonly year: number;
  readonly week: number;
  readonly locale: SupportedLocale;
}

interface GetWeeklyAchievementDependencies {
  readonly repository: Pick<WeeklyAchievementRepositoryPort, "findByYearAndWeek">;
}

export class GetWeeklyAchievementUseCase {
  readonly #dependencies: GetWeeklyAchievementDependencies;

  constructor(dependencies: GetWeeklyAchievementDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetWeeklyAchievementQuery): Promise<WeeklyAchievementView> {
    const { userId, year, week, locale } = input;

    const row = await this.#dependencies.repository.findByYearAndWeek(userId, year, week);

    if (row == null) {
      throw new ApplicationException(ErrorCode.ACHIEVEMENT_1801, {
        year,
        week,
      });
    }

    return toWeeklyAchievementView(row, locale);
  }
}
