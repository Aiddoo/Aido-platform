import type { WeeklyAchievementUpsert } from "../../../domain/policies/weekly-achievements/weekly-achievement.js";
import type { UpsertWeeklyAchievements } from "../../use-cases/weekly-achievements/upsert-weekly-achievements.use-case.js";

/** 스케줄러가 계산한 주간 달성 기록을 영속화하는 모듈 공개 경계. */
export class WeeklyAchievementWriterAccess {
  constructor(private readonly upsertWeeklyAchievementsUseCase: UpsertWeeklyAchievements) {}

  upsertMany(records: WeeklyAchievementUpsert[]): Promise<void> {
    return this.upsertWeeklyAchievementsUseCase.execute({ records });
  }
}
