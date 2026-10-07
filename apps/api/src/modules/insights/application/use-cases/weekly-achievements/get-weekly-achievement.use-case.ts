import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import {
  toWeeklyAchievementView,
  type WeekLabelLocale,
  type WeeklyAchievementView,
} from "../../../domain/policies/weekly-achievements/weekly-achievement.js";
import { type WeeklyAchievementRepositoryPort } from "../../ports/weekly-achievements/weekly-achievement.repository.port.js";

export interface GetWeeklyAchievementInput {
  userId: string;
  year: number;
  week: number;
  locale: WeekLabelLocale;
}

interface GetWeeklyAchievementDependencies {
  readonly repository: WeeklyAchievementRepositoryPort;
}

export class GetWeeklyAchievement {
  readonly #dependencies: GetWeeklyAchievementDependencies;

  constructor(dependencies: GetWeeklyAchievementDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetWeeklyAchievementInput): Promise<WeeklyAchievementView> {
    const { userId, year, week, locale } = input;

    const row = await this.#dependencies.repository.findByYearAndWeek(userId, year, week);

    if (!row) {
      throw new ApplicationException(ErrorCode.ACHIEVEMENT_1801, {
        year,
        week,
      });
    }

    return toWeeklyAchievementView(row, locale);
  }
}
