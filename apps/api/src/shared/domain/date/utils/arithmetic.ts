import dayjs from "dayjs";

import { DATE_FORMAT } from "../constants/date.constant.js";
import { now } from "./core.js";

/** 지정 분 후의 시각 반환 */
export function addMinutes(minutes: number, from: Date = now()): Date {
  return dayjs.utc(from).add(minutes, "minute").toDate();
}

/** 지정 일 후의 시각 반환 */
export function addDays(days: number, from: Date = now()): Date {
  return dayjs.utc(from).add(days, "day").toDate();
}

/** 지정 개월 후의 시각 반환 */
export function addMonths(months: number, from: Date = now()): Date {
  return dayjs.utc(from).add(months, "month").toDate();
}

/** 지정 밀리초 후의 시각 반환 */
export function addMilliseconds(ms: number, from: Date = now()): Date {
  return dayjs.utc(from).add(ms, "millisecond").toDate();
}

/** 지정 초 전의 시각 반환 */
export function subtractSeconds(seconds: number, from: Date = now()): Date {
  return dayjs.utc(from).subtract(seconds, "second").toDate();
}

/** 지정 일 전의 시각 반환 */
export function subtractDays(days: number, from: Date = now()): Date {
  return dayjs.utc(from).subtract(days, "day").toDate();
}

/** 지정 밀리초 전의 시각 반환 */
export function subtractMilliseconds(ms: number, from: Date = now()): Date {
  return dayjs.utc(from).subtract(ms, "millisecond").toDate();
}

/**
 * 달력 날짜 key(YYYY-MM-DD)의 일 산술. 시간대가 없는 값이라 process·DST와 무관하다.
 *
 * @example addDaysToDateKey("2028-02-28", 1)  // "2028-02-29"
 * @example addDaysToDateKey("2026-03-01", -1) // "2026-02-28"
 */
export function addDaysToDateKey(dateKey: string, days: number): string {
  return dayjs.utc(dateKey).add(days, "day").format(DATE_FORMAT.DATE_ONLY);
}
