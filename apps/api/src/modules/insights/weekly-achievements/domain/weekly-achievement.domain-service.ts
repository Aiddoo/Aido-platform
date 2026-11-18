import { last, sortBy, sumBy } from "es-toolkit";

import type { IsoWeek } from "./iso-week.vo.js";
import type { WeeklyAchievement } from "./weekly-achievement.aggregate.js";

export interface WeeklyStreak {
  /** 그해 가장 최근 기록에서 거슬러 올라간 연속 주 수 */
  readonly currentStreak: number;
  /** 그해 안에서 끝난 연속 중 가장 긴 것. 그래서 currentStreak보다 작지 않다 */
  readonly bestStreak: number;
}

export interface WeeklyAchievementSummary extends WeeklyStreak {
  readonly totalWeeks: number;
  readonly perfectWeeks: number;
  readonly averageRate: number;
}

/** 기록이 있는 주를 끊김 없이 이어진 묶음으로 나눈다. weeks는 연도·주 오름차순이다 */
function splitIntoStreaks(weeks: readonly IsoWeek[]): IsoWeek[][] {
  const streaks: IsoWeek[][] = [];
  for (const week of weeks) {
    const streak = last(streaks);
    const previous = streak == null ? undefined : last(streak);
    if (streak != null && previous != null && previous.isFollowedBy(week)) {
      streak.push(week);
    } else {
      streaks.push([week]);
    }
  }
  return streaks;
}

/**
 * 한 해의 연속 주. 해가 바뀌어도 끊지 않아 앞 해에서 이어 온 주까지 세고, 그해 마지막 기록 뒤의 주는 보지 않는다.
 * 그래서 지난해 요약은 다음 해 기록이 쌓여도 바뀌지 않는다
 */
export function computeWeeklyStreak(params: {
  readonly year: number;
  readonly weeks: readonly IsoWeek[];
}): WeeklyStreak {
  const weeksThroughYear = sortBy(
    params.weeks.filter((week) => week.year <= params.year),
    ["year", "week"],
  );
  const streakLengthsEndingInYear = splitIntoStreaks(weeksThroughYear)
    .filter((streak) => last(streak)?.year === params.year)
    .map((streak) => streak.length);
  return {
    currentStreak: last(streakLengthsEndingInYear) ?? 0,
    bestStreak: Math.max(0, ...streakLengthsEndingInYear),
  };
}

/**
 * 한 해 기록의 요약. 주 수·완벽한 주·평균 완료율은 그해 기록만, 연속 주는 앞 해 기록까지 본다.
 * 평균 완료율은 주별 완료율의 반올림 평균이다
 */
export function summarizeWeeklyAchievements(params: {
  readonly year: number;
  readonly achievements: readonly WeeklyAchievement[];
}): WeeklyAchievementSummary {
  const yearAchievements = params.achievements.filter(
    (achievement) => achievement.isoWeek.year === params.year,
  );
  const totalWeeks = yearAchievements.length;
  if (totalWeeks === 0) {
    return { totalWeeks: 0, perfectWeeks: 0, currentStreak: 0, bestStreak: 0, averageRate: 0 };
  }

  return {
    totalWeeks,
    perfectWeeks: yearAchievements.filter((achievement) => achievement.isPerfect()).length,
    ...computeWeeklyStreak({
      year: params.year,
      weeks: params.achievements.map((achievement) => achievement.isoWeek),
    }),
    averageRate: Math.round(
      sumBy(yearAchievements, (achievement) => achievement.completionRate) / totalWeeks,
    ),
  };
}
