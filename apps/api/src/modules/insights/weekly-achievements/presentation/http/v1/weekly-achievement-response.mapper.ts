import type {
  WeeklyAchievementDetailResponse,
  WeeklyAchievementListResponse,
} from "@aido/api/contracts/weekly-achievement";

import type { SupportedLocale } from "#api/shared/domain/locale";
import { toIsoString } from "#api/shared/domain/time/instant";

import type { WeeklyAchievementList } from "../../../application/read-models/weekly-achievement-list.read-model.js";
import type { IsoWeek } from "../../../domain/iso-week.vo.js";
import type { WeeklyAchievement } from "../../../domain/weekly-achievement.entity.js";

const MONTH_SHORT_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

// 출시 앱이 아직 읽는 호환 칸이라 문구를 그대로 둔다. 새 앱은 year·week·dateRange로 직접 표시한다
const WEEK_LABELS: Record<SupportedLocale, (month: number, weekOfMonth: number) => string> = {
  ko: (month, weekOfMonth) => `${month}월 ${weekOfMonth}주차`,
  en: (month, weekOfMonth) => `Week ${weekOfMonth} of ${MONTH_SHORT_EN[month - 1]}`,
};

/** 목요일이 속한 달의 몇째 주인지로 쓴다(그 달 첫 목요일이 있는 주가 1주) */
export function formatWeekLabel(isoWeek: IsoWeek, locale: SupportedLocale): string {
  const thursday = isoWeek.startDate.add({ days: 3 });
  const firstOfMonth = thursday.with({ day: 1 });
  const thursdayOfFirstWeek = firstOfMonth.add({ days: 4 - firstOfMonth.dayOfWeek });
  const firstThursday =
    thursdayOfFirstWeek.month === thursday.month
      ? thursdayOfFirstWeek
      : thursdayOfFirstWeek.add({ weeks: 1 });
  const weekOfMonth = Math.max(1, Math.floor(firstThursday.until(thursday).days / 7) + 1);
  return WEEK_LABELS[locale](thursday.month, weekOfMonth);
}

export function toWeeklyAchievementResponse(
  achievement: WeeklyAchievement,
  locale: SupportedLocale,
): WeeklyAchievementDetailResponse {
  const { isoWeek } = achievement;
  return {
    id: achievement.id.value,
    year: isoWeek.year,
    week: isoWeek.week,
    weekLabel: formatWeekLabel(isoWeek, locale),
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
    items: list.page.items.map((achievement) => toWeeklyAchievementResponse(achievement, locale)),
    pagination: list.page.pagination,
    summary: list.summary,
  };
}
