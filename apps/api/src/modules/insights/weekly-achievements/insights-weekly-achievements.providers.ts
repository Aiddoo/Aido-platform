import type { Provider } from "@nestjs/common";

import { provideUseCase } from "#api/platform/di/provide-use-case";

import { WeeklyAchievementWriterPort } from "./application/ports/weekly-achievement-writer.port.js";
import { WeeklyAchievementRepositoryPort } from "./application/ports/weekly-achievement.repository.port.js";
import { GetWeeklyAchievementUseCase } from "./application/use-cases/get-weekly-achievement.use-case.js";
import { ListWeeklyAchievementsUseCase } from "./application/use-cases/list-weekly-achievements.use-case.js";
import { RecordWeeklyAchievementsUseCase } from "./application/use-cases/record-weekly-achievements.use-case.js";
import { DrizzleWeeklyAchievementRepository } from "./infrastructure/persistence/drizzle-weekly-achievement.repository.js";

export const INSIGHTS_WEEKLY_ACHIEVEMENTS_PROVIDERS = [
  { provide: WeeklyAchievementRepositoryPort, useClass: DrizzleWeeklyAchievementRepository },
  provideUseCase(GetWeeklyAchievementUseCase, {
    weeklyAchievementRepository: WeeklyAchievementRepositoryPort,
  }),
  provideUseCase(ListWeeklyAchievementsUseCase, {
    weeklyAchievementRepository: WeeklyAchievementRepositoryPort,
  }),
  provideUseCase(RecordWeeklyAchievementsUseCase, {
    weeklyAchievementRepository: WeeklyAchievementRepositoryPort,
  }),
  { provide: WeeklyAchievementWriterPort, useExisting: RecordWeeklyAchievementsUseCase },
] satisfies Provider[];
