import { buildWeeklyAchievementSnapshot } from "../../domain/weekly-achievement.domain-service.js";
import type { WeeklyAchievementUpsert } from "../../domain/weekly-achievement.read-model.js";
import type { WeeklyAchievementWriterPort } from "../ports/weekly-achievement-writer.port.js";
import { type WeeklyAchievementRepositoryPort } from "../ports/weekly-achievement.repository.port.js";

export interface UpsertWeeklyAchievementsInput {
  readonly records: readonly WeeklyAchievementUpsert[];
}

interface UpsertWeeklyAchievementsDependencies {
  readonly repository: Pick<WeeklyAchievementRepositoryPort, "upsertMany">;
}

export class UpsertWeeklyAchievements implements WeeklyAchievementWriterPort {
  readonly #dependencies: UpsertWeeklyAchievementsDependencies;

  constructor(dependencies: UpsertWeeklyAchievementsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpsertWeeklyAchievementsInput): Promise<void> {
    if (input.records.length === 0) {
      return;
    }

    const snapshots = input.records.map(buildWeeklyAchievementSnapshot);
    await this.#dependencies.repository.upsertMany(snapshots);
  }
}
