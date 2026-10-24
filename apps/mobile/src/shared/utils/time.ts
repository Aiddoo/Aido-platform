import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

import { getDateFormatContext } from './date';
import { formatTimeOfDay, type TimeFormat } from './date-format';

dayjs.extend(customParseFormat);

export type { TimeFormat };

/** "HH:mm" 형식(두 자리, 엄격)인지 검증 */
export function isValidHHmm(time: string): boolean {
  return dayjs(time, 'HH:mm', true).isValid();
}

/** "HH:mm" → 시 */
export function parseHour(time: string): number {
  return Number(time.split(':')[0]);
}

/** "HH:mm" → 분 */
export function parseMinute(time: string): number {
  return Number(time.split(':')[1]);
}

/** 유효한 시간 문자열이면 그대로, 아니면 fallback (fallback은 항상 유효한 상수라고 가정) */
export function resolveTimeOrFallback(time: string | undefined, fallbackTime: string): string {
  return time != null && isValidHHmm(time) ? time : fallbackTime;
}

/** 날짜에 시·분을 적용하고 초/밀리초를 0으로 초기화 */
export function withTime(date: Date, hour: number, minute: number): Date {
  return dayjs(date).hour(hour).minute(minute).second(0).millisecond(0).toDate();
}

/** 12시간제 여부 */
export function isTwelveHour(timeFormat: TimeFormat): boolean {
  return timeFormat === 'TWELVE_HOUR';
}

export const toHHmm = (date: Date): string => dayjs(date).format('HH:mm');

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

/** 시간+분 정수를 앱 표시 언어에 맞춰 포맷 (ko: "오전 8:30", en: "8:30 AM") */
export const formatReminderTime = (
  hour: number,
  minute: number,
  timeFormat: TimeFormat = 'TWELVE_HOUR',
): string => formatTimeOfDay({ hour, minute }, timeFormat, getDateFormatContext());

/** "HH:mm" 문자열을 사용자 시간 형식에 맞춰 표시용으로 변환 */
export const formatTimeDisplay = (time: string, timeFormat: TimeFormat = 'TWELVE_HOUR'): string => {
  if (!isValidHHmm(time)) {
    return time;
  }
  return formatTimeOfDay(
    { hour: parseHour(time), minute: parseMinute(time) },
    timeFormat,
    getDateFormatContext(),
  );
};
