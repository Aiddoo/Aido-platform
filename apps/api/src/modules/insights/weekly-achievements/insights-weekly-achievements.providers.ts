import type { Provider } from "@nestjs/common";

import { provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import { AchievementOwnerTimezoneReaderPort } from "./application/ports/achievement-owner-timezone.reader.port.js";
import { WeeklyAchievementWriterPort } from "./application/ports/weekly-achievement-writer.port.js";
import { WeeklyAchievementRepositoryPort } from "./application/ports/weekly-achievement.repository.port.js";
import { GetWeeklyAchievementUseCase } from "./application/use-cases/get-weekly-achievement.use-case.js";
import { ListWeeklyAchievementsUseCase } from "./application/use-cases/list-weekly-achievements.use-case.js";
import { RecordWeeklyAchievementsUseCase } from "./application/use-cases/record-weekly-achievements.use-case.js";
import { AchievementOwnerTimezoneReaderAdapter } from "./infrastructure/adapters/achievement-owner-timezone-reader.adapter.js";
import { WeeklyAchievementWriterAdapter } from "./infrastructure/adapters/weekly-achievement-writer.adapter.js";
import { DrizzleWeeklyAchievementRepository } from "./infrastructure/persistence/drizzle-weekly-achievement.repository.js";

export const INSIGHTS_WEEKLY_ACHIEVEMENTS_PROVIDERS = [
  { provide: WeeklyAchievementRepositoryPort, useClass: DrizzleWeeklyAchievementRepository },
  { provide: AchievementOwnerTimezoneReaderPort, useClass: AchievementOwnerTimezoneReaderAdapter },
  { provide: WeeklyAchievementWriterPort, useClass: WeeklyAchievementWriterAdapter },
  provideUseCase(GetWeeklyAchievementUseCase, {
    weeklyAchievementRepository: WeeklyAchievementRepositoryPort,
    ownerTimezoneReader: AchievementOwnerTimezoneReaderPort,
    clock: ClockPort,
  }),
  provideUseCase(ListWeeklyAchievementsUseCase, {
    weeklyAchievementRepository: WeeklyAchievementRepositoryPort,
    ownerTimezoneReader: AchievementOwnerTimezoneReaderPort,
    clock: ClockPort,
  }),
  provideUseCase(RecordWeeklyAchievementsUseCase, {
    weeklyAchievementRepository: WeeklyAchievementRepositoryPort,
  }),
] satisfies Provider[];
