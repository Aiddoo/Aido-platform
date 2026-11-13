import { zip } from "es-toolkit";

import { WeeklyAchievement } from "../../domain/weekly-achievement.aggregate.js";
import type { WeeklyAchievementTally } from "../ports/weekly-achievement-writer.port.js";
import type { WeeklyAchievementRepositoryPort } from "../ports/weekly-achievement.repository.port.js";

export interface RecordWeeklyAchievementsCommand {
  readonly tallies: readonly WeeklyAchievementTally[];
}

export interface RecordWeeklyAchievementsDependencies {
  readonly weeklyAchievementRepository: Pick<
    WeeklyAchievementRepositoryPort,
    "nextIds" | "saveAll"
  >;
}

export class RecordWeeklyAchievementsUseCase {
  readonly #dependencies: RecordWeeklyAchievementsDependencies;

  constructor(dependencies: RecordWeeklyAchievementsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: RecordWeeklyAchievementsCommand): Promise<void> {
    const { weeklyAchievementRepository } = this.#dependencies;
    if (command.tallies.length === 0) {
      return;
    }

    const ids = await weeklyAchievementRepository.nextIds(command.tallies.length);
    const achievements = zip(command.tallies, ids).map(([tally, id]) => {
      if (tally == null || id == null) {
        throw new Error("weekly achievement id count must match tally count");
      }
      return WeeklyAchievement.create({ id, ...tally });
    });

    await weeklyAchievementRepository.saveAll(achievements);
  }
}
