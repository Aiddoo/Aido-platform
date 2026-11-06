import { DAY_MS } from '@src/shared/constants/time.constants';

import { formatDateKey } from './date-format';
import { getDeviceTimezone } from './timezone';

/** LocalDateProvider와 같은 기기 시간대로 Date가 놓인 달력 날짜(YYYY-MM-DD)를 구한다. */
export function toDeviceDateKey(date: Date): string {
  return formatDateKey(date, getDeviceTimezone());
}

/** YYYY-MM-DD에 달력 일수를 더한다 (윤년·월말·연말 포함, 시간대 무관). */
export function addDaysToDateKey(dateKey: string, days: number): string {
  return formatDateKey(new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * DAY_MS), 'UTC');
}

/** 두 YYYY-MM-DD 사이의 달력 일수 (to - from, 시간대·DST 무관). */
export function diffDateKeysInDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** YYYY-MM-DD의 요일 (0=일 … 6=토, Date#getDay()와 같은 인덱스). */
export function getDayOfWeekOfDateKey(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay();
}
