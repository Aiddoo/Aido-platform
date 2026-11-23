import { completionRate, isAllCompleted } from "./completion-rate.js";

/** 주간 배지 종류. 앱 배지 그림과 주간 리마인더 푸시 문구가 같은 판정을 쓴다 */
export const WEEKLY_ACHIEVEMENT_BADGES = ["perfect", "almost", "completed"] as const;
export type WeeklyAchievementBadge = (typeof WEEKLY_ACHIEVEMENT_BADGES)[number];

const ALMOST_RATE_PERCENT = 90;

/**
 * 한 주 할 일 수로 정하는 배지. 모두 끝낸 주만 perfect, 완료율(completionRate)이 90% 이상이면 almost, 나머지는 completed다.
 * 할 일이 없는 주는 completed다
 */
export function weeklyAchievementBadge(
  completedCount: number,
  totalCount: number,
): WeeklyAchievementBadge {
  if (isAllCompleted(completedCount, totalCount)) {
    return "perfect";
  }
  return completionRate(completedCount, totalCount) >= ALMOST_RATE_PERCENT ? "almost" : "completed";
}
