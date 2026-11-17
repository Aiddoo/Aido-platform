import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { WeeklyAchievementRepositoryPort } from "../ports/weekly-achievement.repository.port.js";

export interface ListWeeklyAchievementYearsQuery {
  readonly userId: string;
}

export interface ListWeeklyAchievementYearsDependencies {
  readonly weeklyAchievementRepository: Pick<WeeklyAchievementRepositoryPort, "listRecordedYears">;
}

/** 기록이 있는 ISO 연도(최근 해 먼저). 앱이 해가 바뀐 뒤에도 지난해 배지로 갈 수 있게 연도를 고르는 데 쓴다 */
export class ListWeeklyAchievementYearsUseCase {
  readonly #dependencies: ListWeeklyAchievementYearsDependencies;

  constructor(dependencies: ListWeeklyAchievementYearsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: ListWeeklyAchievementYearsQuery): Promise<number[]> {
    return this.#dependencies.weeklyAchievementRepository.listRecordedYears(
      UserId.reconstitute(query.userId),
    );
  }
}
