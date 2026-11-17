import type { CursorPage } from "#api/shared/application/cursor-page";

import type { WeeklyAchievement } from "../../domain/weekly-achievement.aggregate.js";
import type { WeeklyAchievementSummary } from "../../domain/weekly-achievement.domain-service.js";

export interface WeeklyAchievementListReadModel {
  /** 커서는 마지막 항목의 주 번호다 */
  readonly page: CursorPage<WeeklyAchievement, number>;
  /** 페이지와 상관없이 그해 기록 전부로 계산하고, 연속 주는 앞 해에서 이어 온 주까지 센다 */
  readonly summary: WeeklyAchievementSummary;
  /** 사용자 저장 시간대의 오늘. 주차 라벨의 연도를 정한다 */
  readonly localToday: Temporal.PlainDate;
}
