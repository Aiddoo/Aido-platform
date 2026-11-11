import { zip } from "es-toolkit";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { WeeklyAchievement } from "../../domain/weekly-achievement.entity.js";
import type {
  RecordWeeklyAchievementsCommand,
  WeeklyAchievementWriterPort,
} from "../ports/weekly-achievement-writer.port.js";
import type { WeeklyAchievementRepositoryPort } from "../ports/weekly-achievement.repository.port.js";

export interface RecordWeeklyAchievementsDependencies {
  readonly weeklyAchievementRepository: Pick<
    WeeklyAchievementRepositoryPort,
    "nextIds" | "saveAll"
  >;
}

export class RecordWeeklyAchievementsUseCase implements WeeklyAchievementWriterPort {
  readonly #dependencies: RecordWeeklyAchievementsDependencies;

  constructor(dependencies: RecordWeeklyAchievementsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: RecordWeeklyAchievementsCommand): Promise<void> {
    const { weeklyAchievementRepository } = this.#dependencies;
    if (command.records.length === 0) {
      return;
    }

    const ids = await weeklyAchievementRepository.nextIds(command.records.length);
    const achievements = zip(command.records, ids).map(([record, id]) => {
      if (record == null || id == null) {
        throw new Error("weekly achievement id count must match record count");
      }
      return WeeklyAchievement.create({
        id,
        userId: UserId.reconstitute(record.userId),
        year: record.year,
        week: record.week,
        totalTodos: record.totalTodos,
        completedTodos: record.completedTodos,
        achievedAt: record.achievedAt,
      });
    });
    await weeklyAchievementRepository.saveAll(achievements);
  }
}
