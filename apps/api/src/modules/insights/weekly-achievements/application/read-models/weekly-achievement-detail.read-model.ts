import type { WeeklyAchievement } from "../../domain/weekly-achievement.aggregate.js";

export interface WeeklyAchievementDetail {
  readonly achievement: WeeklyAchievement;
  /** 사용자 저장 시간대의 오늘. 주차 라벨의 연도를 정한다 */
  readonly localToday: Temporal.PlainDate;
}
