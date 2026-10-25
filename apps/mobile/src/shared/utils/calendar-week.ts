import dayjs from 'dayjs';

import { addDaysToDateKey } from './date-key';

export interface CalendarWeekOfDateKey {
  startDateKey: string;
  endDateKey: string;
  weekOfMonth: number;
}

const DAYS_PER_WEEK = 7;

/**
 * 앱 달력 주(일요일 시작). YYYY-MM-DD 그대로 계산해 기기 시간대·DST·표시 언어와 무관하다.
 * 주차는 그 주가 시작한 달 기준이다 (2027-01-01 → 2026-12-27 시작, 12월 4주차).
 */
export function getCalendarWeekOfDateKey(dateKey: string): CalendarWeekOfDateKey {
  const weekday = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
  const startDateKey = addDaysToDateKey(dateKey, -weekday);
  return {
    startDateKey,
    endDateKey: addDaysToDateKey(startDateKey, DAYS_PER_WEEK - 1),
    weekOfMonth: Math.ceil(Number(startDateKey.slice(8, 10)) / DAYS_PER_WEEK),
  };
}

/** 로컬 달력 Date의 앱 달력 주. start는 그 주 일요일 0시, end는 토요일 23:59:59.999. */
export function getCalendarWeek(date: Date) {
  const week = getCalendarWeekOfDateKey(dayjs(date).format('YYYY-MM-DD'));
  return {
    start: dayjs(week.startDateKey).toDate(),
    end: dayjs(week.endDateKey).endOf('day').toDate(),
    weekOfMonth: week.weekOfMonth,
  };
}
