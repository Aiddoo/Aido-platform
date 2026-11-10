import { buildWeeklyAchievementSnapshot } from "../../domain/weekly-achievement.domain-service.js";
import type { WeeklyAchievementUpsert } from "../../domain/weekly-achievement.read-model.js";
import type { WeeklyAchievementWriterPort } from "../ports/weekly-achievement-writer.port.js";
import { type WeeklyAchievementRepositoryPort } from "../ports/weekly-achievement.repository.port.js";

export interface RecordWeeklyAchievementsCommand {
  readonly records: readonly WeeklyAchievementUpsert[];
}

interface RecordWeeklyAchievementsDependencies {
  readonly repository: Pick<WeeklyAchievementRepositoryPort, "upsertMany">;
}

export class RecordWeeklyAchievementsUseCase implements WeeklyAchievementWriterPort {
  readonly #dependencies: RecordWeeklyAchievementsDependencies;

  constructor(dependencies: RecordWeeklyAchievementsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: RecordWeeklyAchievementsCommand): Promise<void> {
    if (input.records.length === 0) {
      return;
    }

    const snapshots = input.records.map(buildWeeklyAchievementSnapshot);
    await this.#dependencies.repository.upsertMany(snapshots);
  }
}
