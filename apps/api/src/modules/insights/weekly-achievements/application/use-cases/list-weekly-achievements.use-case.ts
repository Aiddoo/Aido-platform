import { clampPageSize, toCursorPage } from "#api/shared/application/cursor-page";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { localDateIn } from "#api/shared/domain/time/time-zone-name";

import { summarizeWeeklyAchievements } from "../../domain/weekly-achievement.domain-service.js";
import type { AchievementOwnerTimezoneReaderPort } from "../ports/achievement-owner-timezone.reader.port.js";
import type { WeeklyAchievementRepositoryPort } from "../ports/weekly-achievement.repository.port.js";
import type { WeeklyAchievementList } from "../read-models/weekly-achievement-list.read-model.js";

export interface ListWeeklyAchievementsQuery {
  readonly userId: string;
  readonly year: number;
  readonly cursor?: number;
  readonly size?: number;
}

export interface ListWeeklyAchievementsDependencies {
  readonly weeklyAchievementRepository: Pick<
    WeeklyAchievementRepositoryPort,
    "listByYear" | "listAllByYear"
  >;
  readonly ownerTimezoneReader: Pick<AchievementOwnerTimezoneReaderPort, "read">;
  readonly clock: ClockPort;
}

export class ListWeeklyAchievementsUseCase {
  readonly #dependencies: ListWeeklyAchievementsDependencies;

  constructor(dependencies: ListWeeklyAchievementsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: ListWeeklyAchievementsQuery): Promise<WeeklyAchievementList> {
    const { weeklyAchievementRepository, ownerTimezoneReader, clock } = this.#dependencies;
    const userId = UserId.reconstitute(query.userId);
    const size = clampPageSize(query.size);

    const [rows, yearAchievements, timezone] = await Promise.all([
      weeklyAchievementRepository.listByYear({
        userId,
        year: query.year,
        afterWeek: query.cursor ?? null,
        limit: size + 1,
      }),
      weeklyAchievementRepository.listAllByYear({ userId, year: query.year }),
      ownerTimezoneReader.read(userId),
    ]);

    return {
      page: toCursorPage({ rows, size, toCursor: (achievement) => achievement.isoWeek.week }),
      summary: summarizeWeeklyAchievements(yearAchievements),
      localToday: localDateIn(clock.now(), timezone),
    };
  }
}
