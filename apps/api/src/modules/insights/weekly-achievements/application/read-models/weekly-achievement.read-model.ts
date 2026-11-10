import dayjs from "dayjs";

import { DEFAULT_LOCALE, type SupportedLocale } from "#api/shared/domain/locale";

import {
  completionRateOf,
  computeDateRange,
} from "../../domain/weekly-achievement.domain-service.js";
import type { WeeklyAchievementRow } from "../../domain/weekly-achievement.read-model.js";
import { formatWeekLabel } from "../messages/weekly-achievement.messages.js";

export interface WeeklyAchievementView {
  readonly id: number;
  readonly year: number;
  readonly week: number;
  readonly weekLabel: string;
  readonly dateRange: { readonly startDate: string; readonly endDate: string };
  readonly totalTodos: number;
  readonly completedTodos: number;
  readonly completionRate: number;
  readonly achievedAt: string;
}

export function computeWeekLabel(
  year: number,
  week: number,
  locale: SupportedLocale = DEFAULT_LOCALE,
): string {
  const thursday = dayjs.utc(`${year}-01-04`).isoWeek(week).isoWeekday(4);
  const month = thursday.month() + 1;
  const firstThursday = thursday.startOf("month").isoWeekday(4);
  const firstInMonth =
    firstThursday.month() + 1 === month ? firstThursday : firstThursday.add(7, "day");
  const weekInMonth = Math.max(1, Math.floor(thursday.diff(firstInMonth, "day") / 7) + 1);

  return formatWeekLabel(month, weekInMonth, locale);
}

export function toWeeklyAchievementView(
  row: WeeklyAchievementRow,
  locale: SupportedLocale = DEFAULT_LOCALE,
): WeeklyAchievementView {
  return {
    id: row.id,
    year: row.year,
    week: row.week,
    weekLabel: computeWeekLabel(row.year, row.week, locale),
    dateRange: computeDateRange(row.year, row.week),
    totalTodos: row.totalTodos,
    completedTodos: row.completedTodos,
    completionRate: completionRateOf(row.totalTodos, row.completedTodos),
    achievedAt: row.achievedAt.toISOString(),
  };
}
