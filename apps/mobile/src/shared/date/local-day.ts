import dayjs from 'dayjs';

import {
  addDaysToDateKey,
  addMonthsToDateKey,
  diffDateKeysInMonths,
  getMonthStartDateKey,
} from './date-key';
import { toDateKey } from './instant';

/**
 * 달력 칸이 들고 다니는 Date. 그 날짜의 기기(process) 시간대 자정이다.
 * 날짜 계산은 key로 하고 Date는 마지막에 만든다. 그래야 자정·시간대·서머타임에 날이 밀리지 않는다.
 */
export function toLocalDay(dateKey: string): Date {
  return dayjs(dateKey).toDate();
}

export function startOfLocalDay(date: Date, timeZone: string): Date {
  return toLocalDay(toDateKey(date, timeZone));
}

export function addLocalDays(date: Date, days: number, timeZone: string): Date {
  return toLocalDay(addDaysToDateKey(toDateKey(date, timeZone), days));
}

export function addLocalMonths(date: Date, months: number, timeZone: string): Date {
  return toLocalDay(addMonthsToDateKey(toDateKey(date, timeZone), months));
}

export function startOfLocalMonth(date: Date, timeZone: string): Date {
  return toLocalDay(getMonthStartDateKey(toDateKey(date, timeZone)));
}

/** 달만 옮기고 일은 기준 날짜의 일을 쓴다. 그 달에 없는 일은 마지막 날이다 */
export function moveToLocalMonth(date: Date, monthSource: Date, timeZone: string): Date {
  return addLocalMonths(date, diffLocalMonths(monthSource, date, timeZone), timeZone);
}

/** 두 날짜의 달 차이 (first - second) */
export function diffLocalMonths(first: Date, second: Date, timeZone: string): number {
  return diffDateKeysInMonths(toDateKey(second, timeZone), toDateKey(first, timeZone));
}
