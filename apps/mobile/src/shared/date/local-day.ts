import { DAYS_PER_WEEK } from '@src/shared/constants/time.constants';

import { addDaysToDateKey, getDaysInDateKeyMonth, getDayOfMonth } from './date-key';
import { toDateKey } from './instant';

/**
 * 달력 칸이 들고 다니는 Date. 그 날짜의 기기(process) 시간대 자정이다.
 * 날짜 계산은 key로 하고 Date는 마지막에 만든다. 그래야 자정·시간대·서머타임에 날이 밀리지 않는다.
 */
export function toLocalDay(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);

  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

export function startOfLocalDay(date: Date, timeZone: string): Date {
  return toLocalDay(toDateKey(date, timeZone));
}

export function addLocalDays(date: Date, days: number, timeZone: string): Date {
  return toLocalDay(addDaysToDateKey(toDateKey(date, timeZone), days));
}

export function addLocalWeeks(date: Date, weeks: number, timeZone: string): Date {
  return addLocalDays(date, weeks * DAYS_PER_WEEK, timeZone);
}

export function startOfLocalMonth(date: Date, timeZone: string): Date {
  return toLocalDay(`${toDateKey(date, timeZone).slice(0, 7)}-01`);
}

/** 달을 옮긴다. 옮긴 달에 없는 일(31일 → 2월)은 그 달의 마지막 날로 맞춘다 */
export function addLocalMonths(date: Date, months: number, timeZone: string): Date {
  const [year = 0, month = 1] = toDateKey(date, timeZone).split('-').map(Number);
  const target = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(target / 12);
  const targetMonth = (target % 12) + 1;
  const firstOfTarget = `${String(targetYear).padStart(4, '0')}-${String(targetMonth).padStart(2, '0')}-01`;
  const day = Math.min(
    getDayOfMonth(toDateKey(date, timeZone)),
    getDaysInDateKeyMonth(firstOfTarget),
  );

  return toLocalDay(addDaysToDateKey(firstOfTarget, day - 1));
}

/** 달만 옮기고 일은 기준 날짜의 일을 쓴다. 그 달에 없는 일은 마지막 날이다 */
export function moveToLocalMonth(date: Date, monthSource: Date, timeZone: string): Date {
  const monthKey = toDateKey(monthSource, timeZone);
  const day = Math.min(getDayOfMonth(toDateKey(date, timeZone)), getDaysInDateKeyMonth(monthKey));

  return toLocalDay(`${monthKey.slice(0, 7)}-${String(day).padStart(2, '0')}`);
}

/** 두 날짜의 달 차이 (first - second) */
export function diffLocalMonths(first: Date, second: Date, timeZone: string): number {
  const [firstYear = 0, firstMonth = 1] = toDateKey(first, timeZone).split('-').map(Number);
  const [secondYear = 0, secondMonth = 1] = toDateKey(second, timeZone).split('-').map(Number);

  return (firstYear - secondYear) * 12 + (firstMonth - secondMonth);
}
