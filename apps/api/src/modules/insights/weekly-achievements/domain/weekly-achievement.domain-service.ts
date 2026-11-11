import { sortBy, sumBy } from "es-toolkit";

import type { IsoWeek } from "./iso-week.vo.js";
import type { WeeklyAchievement } from "./weekly-achievement.entity.js";

export interface WeeklyStreak {
  /** 가장 최근 기록에서 거슬러 올라간 연속 주 수 */
  readonly currentStreak: number;
  readonly bestStreak: number;
}

export interface WeeklyAchievementSummary extends WeeklyStreak {
  readonly totalWeeks: number;
  readonly perfectWeeks: number;
  readonly averageRate: number;
}

/** 기록이 있는 주의 연속 길이. weeks는 연도·주 오름차순이다 */
export function computeWeeklyStreak(weeks: readonly IsoWeek[]): WeeklyStreak {
  if (weeks.length === 0) {
    return { currentStreak: 0, bestStreak: 0 };
  }

  let bestStreak = 1;
  let streak = 1;
  for (const [index, week] of weeks.entries()) {
    const previous = weeks[index - 1];
    if (previous == null) {
      continue;
    }
    streak = previous.isFollowedBy(week) ? streak + 1 : 1;
    bestStreak = Math.max(bestStreak, streak);
  }
  return { currentStreak: streak, bestStreak };
}

/** 한 해 기록의 요약. 평균 완료율은 주별 완료율의 반올림 평균이다 */
export function summarizeWeeklyAchievements(
  achievements: readonly WeeklyAchievement[],
): WeeklyAchievementSummary {
  const totalWeeks = achievements.length;
  if (totalWeeks === 0) {
    return { totalWeeks: 0, perfectWeeks: 0, currentStreak: 0, bestStreak: 0, averageRate: 0 };
  }

  const weeks = sortBy(
    achievements.map((achievement) => achievement.isoWeek),
    ["year", "week"],
  );
  return {
    totalWeeks,
    perfectWeeks: achievements.filter((achievement) => achievement.isPerfect).length,
    ...computeWeeklyStreak(weeks),
    averageRate: Math.round(
      sumBy(achievements, (achievement) => achievement.completionRate) / totalWeeks,
    ),
  };
}
