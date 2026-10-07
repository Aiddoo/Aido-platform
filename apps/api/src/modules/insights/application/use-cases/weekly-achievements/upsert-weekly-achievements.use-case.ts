import {
  buildWeeklyAchievementSnapshot,
  type WeeklyAchievementUpsert,
} from "../../../domain/policies/weekly-achievements/weekly-achievement.js";
import { type WeeklyAchievementRepositoryPort } from "../../ports/weekly-achievements/weekly-achievement.repository.port.js";

export interface UpsertWeeklyAchievementsInput {
  records: WeeklyAchievementUpsert[];
}

interface UpsertWeeklyAchievementsDependencies {
  readonly repository: WeeklyAchievementRepositoryPort;
}

export class UpsertWeeklyAchievements {
  readonly #dependencies: UpsertWeeklyAchievementsDependencies;

  constructor(dependencies: UpsertWeeklyAchievementsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpsertWeeklyAchievementsInput): Promise<void> {
    if (input.records.length === 0) {
      return;
    }

    // 도메인 불변식(완료 수 ≤ 전체 수, 주차 범위) 검증 후 영속
    const snapshots = input.records.map(buildWeeklyAchievementSnapshot);
    await this.#dependencies.repository.upsertMany(snapshots);
  }
}
