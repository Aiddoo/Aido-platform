import { timeOfDaySchema } from '@aido/api';
import dayjs from 'dayjs';

import {
  type DateFormatContext,
  formatTimeOfDay,
  formatZonedHHmm,
  type TimeFormat,
} from './date-format';
import { getDeviceTimezone } from './timezone';

export type { TimeFormat };

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

/** 순간을 기기 시간대(LocalDateProvider와 같은 출처)의 HH:mm으로 읽는다 */
export const toHHmm = (date: Date): string => formatZonedHHmm(date, getDeviceTimezone());

export const getDateWithTime = (
  date: Date,
  time: string | undefined,
  fallbackTime: string,
): Date => {
  const safe = resolveTimeOrFallback(time, fallbackTime);
  return withTime(date, parseHour(safe), parseMinute(safe));
};

/** 시간+분 정수를 오늘 날짜의 Date 객체로 변환 (DatePicker용) */
export const timeToDate = (hour: number, minute: number): Date =>
  withTime(new Date(), hour, minute);

/**
 * 네이티브 DateTimePicker의 locale prop 값.
 * 24시간제는 en_GB(오전/오후 없는 스피너)로 강제하고,
 * 12시간제는 앱 표시 언어를 따른다.
 */
export const getPickerLocale = (
  resolvedLanguage: 'ko' | 'en',
  timeFormat: TimeFormat = 'TWELVE_HOUR',
): string => {
  if (!isTwelveHour(timeFormat)) {
    return 'en_GB';
  }
  return resolvedLanguage === 'en' ? 'en_US' : 'ko';
};

/** "HH:mm" 문자열을 사용자 시간 형식에 맞춰 표시용으로 변환 */
export const formatTimeDisplay = (
  time: string,
  timeFormat: TimeFormat,
  context: DateFormatContext,
): string => {
  if (!isValidHHmm(time)) {
    return time;
  }
  return formatTimeOfDay({ hour: parseHour(time), minute: parseMinute(time) }, timeFormat, context);
};
