import { Injectable } from "@nestjs/common";

import {
  type WeeklyAchievementTally,
  WeeklyAchievementWriterPort,
} from "../../application/ports/weekly-achievement-writer.port.js";
import { RecordWeeklyAchievementsUseCase } from "../../application/use-cases/record-weekly-achievements.use-case.js";

// 다른 Context에 여는 문. 입력은 UseCase 명령과 같아 그대로 넘긴다
@Injectable()
export class WeeklyAchievementWriterAdapter extends WeeklyAchievementWriterPort {
  readonly #recordWeeklyAchievements: Pick<RecordWeeklyAchievementsUseCase, "execute">;

  constructor(recordWeeklyAchievements: RecordWeeklyAchievementsUseCase) {
    super();
    this.#recordWeeklyAchievements = recordWeeklyAchievements;
  }

  record(tallies: readonly WeeklyAchievementTally[]): Promise<void> {
    return this.#recordWeeklyAchievements.execute({ tallies });
  }
}
