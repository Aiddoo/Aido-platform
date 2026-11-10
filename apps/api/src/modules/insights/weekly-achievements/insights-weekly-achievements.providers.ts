import { type FactoryProvider } from "@nestjs/common";

import { PaginationService } from "#api/shared/application/pagination/index";

import { WEEKLY_ACHIEVEMENT_REPOSITORY } from "./application/ports/weekly-achievement.repository.port.js";
import { GetWeeklyAchievementUseCase } from "./application/use-cases/get-weekly-achievement.use-case.js";
import { ListWeeklyAchievementsUseCase } from "./application/use-cases/list-weekly-achievements.use-case.js";
import { RecordWeeklyAchievementsUseCase } from "./application/use-cases/record-weekly-achievements.use-case.js";

export const getWeeklyAchievementProvider: FactoryProvider<GetWeeklyAchievementUseCase> = {
  provide: GetWeeklyAchievementUseCase,
  inject: [WEEKLY_ACHIEVEMENT_REPOSITORY],
  useFactory: (
    repository: ConstructorParameters<typeof GetWeeklyAchievementUseCase>[0]["repository"],
  ) => new GetWeeklyAchievementUseCase({ repository }),
};

export const getWeeklyAchievementsProvider: FactoryProvider<ListWeeklyAchievementsUseCase> = {
  provide: ListWeeklyAchievementsUseCase,
  inject: [WEEKLY_ACHIEVEMENT_REPOSITORY, PaginationService],
  useFactory: (
    repository: ConstructorParameters<typeof ListWeeklyAchievementsUseCase>[0]["repository"],
    paginationService: ConstructorParameters<
      typeof ListWeeklyAchievementsUseCase
    >[0]["paginationService"],
  ) =>
    new ListWeeklyAchievementsUseCase({
      repository,
      paginationService,
    }),
};

export const upsertWeeklyAchievementsProvider: FactoryProvider<RecordWeeklyAchievementsUseCase> = {
  provide: RecordWeeklyAchievementsUseCase,
  inject: [WEEKLY_ACHIEVEMENT_REPOSITORY],
  useFactory: (
    repository: ConstructorParameters<typeof RecordWeeklyAchievementsUseCase>[0]["repository"],
  ) => new RecordWeeklyAchievementsUseCase({ repository }),
};
