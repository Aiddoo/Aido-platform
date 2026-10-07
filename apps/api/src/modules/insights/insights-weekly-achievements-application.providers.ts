import { type FactoryProvider } from "@nestjs/common";

import { PaginationService } from "#api/shared/application/pagination/index";

import { WEEKLY_ACHIEVEMENT_REPOSITORY } from "./application/ports/weekly-achievements/weekly-achievement.repository.port.js";
import { GetWeeklyAchievement } from "./application/use-cases/weekly-achievements/get-weekly-achievement.use-case.js";
import { GetWeeklyAchievements } from "./application/use-cases/weekly-achievements/get-weekly-achievements.use-case.js";
import { UpsertWeeklyAchievements } from "./application/use-cases/weekly-achievements/upsert-weekly-achievements.use-case.js";

export const getWeeklyAchievementProvider: FactoryProvider<GetWeeklyAchievement> = {
  provide: GetWeeklyAchievement,
  inject: [WEEKLY_ACHIEVEMENT_REPOSITORY],
  useFactory: (repository: ConstructorParameters<typeof GetWeeklyAchievement>[0]["repository"]) =>
    new GetWeeklyAchievement({ repository }),
};

export const getWeeklyAchievementsProvider: FactoryProvider<GetWeeklyAchievements> = {
  provide: GetWeeklyAchievements,
  inject: [WEEKLY_ACHIEVEMENT_REPOSITORY, PaginationService],
  useFactory: (
    repository: ConstructorParameters<typeof GetWeeklyAchievements>[0]["repository"],
    paginationService: ConstructorParameters<typeof GetWeeklyAchievements>[0]["paginationService"],
  ) =>
    new GetWeeklyAchievements({
      repository,
      paginationService,
    }),
};

export const upsertWeeklyAchievementsProvider: FactoryProvider<UpsertWeeklyAchievements> = {
  provide: UpsertWeeklyAchievements,
  inject: [WEEKLY_ACHIEVEMENT_REPOSITORY],
  useFactory: (
    repository: ConstructorParameters<typeof UpsertWeeklyAchievements>[0]["repository"],
  ) => new UpsertWeeklyAchievements({ repository }),
};
