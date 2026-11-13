import type {
  WeeklyAchievementDetailResponse,
  WeeklyAchievementListResponse,
} from "@aido/api/contracts/weekly-achievement";

import type { SupportedLocale } from "#api/shared/domain/locale";
import { toIsoString } from "#api/shared/domain/time/instant";
import { formatIsoWeekLabel } from "#api/shared/domain/time/week-of-month";

import type { WeeklyAchievementList } from "../../../application/read-models/weekly-achievement-list.read-model.js";
import type { WeeklyAchievement } from "../../../domain/weekly-achievement.entity.js";

/** `localToday`는 읽는 사용자 시간대의 오늘이다. 다른 해의 주는 라벨에 연도를 붙인다 */
export function toWeeklyAchievementResponse(
  achievement: WeeklyAchievement,
  locale: SupportedLocale,
  localToday: Temporal.PlainDate,
): WeeklyAchievementDetailResponse {
  const { isoWeek } = achievement;
  return {
    id: achievement.id.value,
    year: isoWeek.year,
    week: isoWeek.week,
    weekLabel: formatIsoWeekLabel(isoWeek.startDate, locale, localToday),
    dateRange: { startDate: isoWeek.startDate.toString(), endDate: isoWeek.endDate.toString() },
    totalTodos: achievement.totalTodos,
    completedTodos: achievement.completedTodos,
    completionRate: achievement.completionRate,
    achievedAt: toIsoString(achievement.achievedAt),
  };
}

export function toWeeklyAchievementListResponse(
  list: WeeklyAchievementList,
  locale: SupportedLocale,
): WeeklyAchievementListResponse {
  return {
    items: list.page.items.map((achievement) =>
      toWeeklyAchievementResponse(achievement, locale, list.localToday),
    ),
    pagination: list.page.pagination,
    summary: list.summary,
  };
}
