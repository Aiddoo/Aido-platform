/** 주간 배지 종류. 앱 배지 그림과 주간 리마인더 푸시 문구가 같은 판정을 쓴다 */
export const WEEKLY_ACHIEVEMENT_BADGES = ["perfect", "almost", "completed"] as const;
export type WeeklyAchievementBadge = (typeof WEEKLY_ACHIEVEMENT_BADGES)[number];

const ALMOST_RATE_PERCENT = 90;
// 끝내지 않은 할 일이 있으면 반올림해 100%가 되어도 99%로 본다(199/200은 빈틈없는 한 주가 아니다)
const UNFINISHED_MAX_RATE_PERCENT = 99;

/**
 * 한 주 할 일 수로 정하는 배지. 모두 끝낸 주만 perfect, 반올림 완료율이 90% 이상이면 almost, 나머지는 completed다.
 * 할 일이 없는 주는 completed다
 */
export function weeklyAchievementBadge(
  completedCount: number,
  totalCount: number,
): WeeklyAchievementBadge {
  if (totalCount > 0 && completedCount === totalCount) {
    return "perfect";
  }
  const ratePercent =
    totalCount > 0
      ? Math.min(UNFINISHED_MAX_RATE_PERCENT, Math.round((completedCount / totalCount) * 100))
      : 0;
  return ratePercent >= ALMOST_RATE_PERCENT ? "almost" : "completed";
}
