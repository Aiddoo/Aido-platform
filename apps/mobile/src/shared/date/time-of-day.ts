import { timeOfDaySchema } from '@aido/api';
import dayjs from 'dayjs';

import type { TimeFormat } from './date-format';

export function isValidHHmm(time: string): boolean {
  return timeOfDaySchema.safeParse(time).success;
}

export function parseHour(time: string): number {
  return Number(time.split(':')[0]);
}

export function parseMinute(time: string): number {
  return Number(time.split(':')[1]);
}

/** 유효한 시간 문자열이면 그대로, 아니면 fallback (fallback은 항상 유효한 상수라고 가정) */
export function resolveTimeOrFallback(time: string | undefined, fallbackTime: string): string {
  return time != null && isValidHHmm(time) ? time : fallbackTime;
}

export function withTime(date: Date, hour: number, minute: number): Date {
  return dayjs(date).hour(hour).minute(minute).second(0).millisecond(0).toDate();
}

export function isTwelveHour(timeFormat: TimeFormat): boolean {
  return timeFormat === 'TWELVE_HOUR';
}

export function getDateWithTime(date: Date, time: string | undefined, fallbackTime: string): Date {
  const safe = resolveTimeOrFallback(time, fallbackTime);
  return withTime(date, parseHour(safe), parseMinute(safe));
}

/** 시간+분 정수를 오늘 날짜의 Date 객체로 변환 (DatePicker용) */
export function timeToDate(hour: number, minute: number): Date {
  return withTime(new Date(), hour, minute);
}

/**
 * 네이티브 DateTimePicker의 locale prop 값.
 * 24시간제는 en_GB(오전/오후 없는 스피너)로 강제하고,
 * 12시간제는 앱 표시 언어를 따른다.
 */
export function getPickerLocale(
  resolvedLanguage: 'ko' | 'en',
  timeFormat: TimeFormat = 'TWELVE_HOUR',
): string {
  if (!isTwelveHour(timeFormat)) {
    return 'en_GB';
  }
  return resolvedLanguage === 'en' ? 'en_US' : 'ko';
}
