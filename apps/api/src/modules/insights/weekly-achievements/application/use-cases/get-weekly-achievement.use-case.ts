import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { localDateIn } from "#api/shared/domain/time/time-zone-name";

import { IsoWeek } from "../../domain/iso-week.vo.js";
import type { AchievementOwnerTimezoneReaderPort } from "../ports/achievement-owner-timezone.reader.port.js";
import type { WeeklyAchievementRepositoryPort } from "../ports/weekly-achievement.repository.port.js";
import type { WeeklyAchievementDetail } from "../read-models/weekly-achievement-detail.read-model.js";
import { weeklyAchievementNotFound } from "../weekly-achievements.errors.js";

export interface GetWeeklyAchievementQuery {
  readonly userId: string;
  readonly year: number;
  readonly week: number;
}

export interface GetWeeklyAchievementDependencies {
  readonly weeklyAchievementRepository: Pick<WeeklyAchievementRepositoryPort, "findByWeek">;
  readonly ownerTimezoneReader: Pick<AchievementOwnerTimezoneReaderPort, "read">;
  readonly clock: ClockPort;
}

export class GetWeeklyAchievementUseCase {
  readonly #dependencies: GetWeeklyAchievementDependencies;

  constructor(dependencies: GetWeeklyAchievementDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetWeeklyAchievementQuery): Promise<WeeklyAchievementDetail> {
    const userId = UserId.reconstitute(query.userId);
    const isoWeek = IsoWeek.create(query.year, query.week);
    const achievement = await this.#dependencies.weeklyAchievementRepository.findByWeek({
      userId,
      isoWeek,
    });
    if (achievement == null) {
      throw weeklyAchievementNotFound(isoWeek);
    }
    const timezone = await this.#dependencies.ownerTimezoneReader.read(userId);
    return { achievement, localToday: localDateIn(this.#dependencies.clock.now(), timezone) };
  }
}
