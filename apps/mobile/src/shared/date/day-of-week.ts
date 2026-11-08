import { DAY_OF_WEEK_MAP, DAYS_OF_WEEK, type DayOfWeek } from '@aido/api/vocabulary';

import { getDayOfWeek } from './date-key';

/** 요일 목록을 월~일 순서로 정렬한다. 저장 순서가 달라도 같은 모양이 된다 */
export function sortDaysOfWeek(days: readonly DayOfWeek[]): DayOfWeek[] {
  return DAYS_OF_WEEK.filter((day) => days.includes(day));
}

/** 순서와 상관없이 같은 요일들인지 */
export function hasSameDaysOfWeek(
  days: readonly DayOfWeek[],
  expected: readonly DayOfWeek[],
): boolean {
  return days.length === expected.length && expected.every((day) => days.includes(day));
}

/** YYYY-MM-DD 날짜의 요일 */
export function getDateKeyDayOfWeek(dateKey: string): DayOfWeek {
  const weekday = getDayOfWeek(dateKey);
  return DAYS_OF_WEEK.find((day) => DAY_OF_WEEK_MAP[day] === weekday) ?? 'MON';
}
