import { DAY_MS, DAYS_PER_WEEK } from '@src/shared/constants/time.constants';

import { toDateKey } from './instant';

/** YYYY-MM-DD에 달력 일수를 더한다 (윤년·월말·연말 포함, 시간대 무관). */
export function addDaysToDateKey(dateKey: string, days: number): string {
  return toDateKey(new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * DAY_MS), 'UTC');
}

/** 두 YYYY-MM-DD 사이의 달력 일수 (to - from, 시간대·DST 무관). */
export function diffDateKeysInDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** YYYY-MM-DD의 요일 (0=일 … 6=토, Date#getDay()와 같은 인덱스). */
export function getDayOfWeek(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay();
}

export interface CalendarWeek {
  startDateKey: string;
  endDateKey: string;
  weekOfMonth: number;
}

/**
 * 앱 달력 주(일요일 시작). YYYY-MM-DD 그대로 계산해 기기 시간대·DST·표시 언어와 무관하다.
 * 주차는 그 주가 시작한 달 기준이다 (2027-01-01 → 2026-12-27 시작, 12월 4주차).
 */
export function getCalendarWeek(dateKey: string): CalendarWeek {
  const startDateKey = addDaysToDateKey(dateKey, -getDayOfWeek(dateKey));
  return {
    startDateKey,
    endDateKey: addDaysToDateKey(startDateKey, DAYS_PER_WEEK - 1),
    weekOfMonth: Math.ceil(Number(startDateKey.slice(8, 10)) / DAYS_PER_WEEK),
  };
}
