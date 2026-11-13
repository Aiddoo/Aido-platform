import { DAY_OF_WEEK_MAP, DAYS_OF_WEEK, type DayOfWeek } from '@aido/api/vocabulary';

import { type DateKey, getDayOfWeek } from './date-key';

export function sortDaysOfWeek(days: readonly DayOfWeek[]): DayOfWeek[] {
  return DAYS_OF_WEEK.filter((day) => days.includes(day));
}

export function hasSameDaysOfWeek(
  days: readonly DayOfWeek[],
  expected: readonly DayOfWeek[],
): boolean {
  return days.length === expected.length && expected.every((day) => days.includes(day));
}

export function getDateKeyDayOfWeek(dateKey: DateKey): DayOfWeek {
  const weekday = getDayOfWeek(dateKey);
  return DAYS_OF_WEEK.find((day) => DAY_OF_WEEK_MAP[day] === weekday) ?? 'MON';
}
