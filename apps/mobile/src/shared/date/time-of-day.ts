import { timeOfDaySchema } from '@aido/api/common';
import type { SupportedLocale } from '@aido/api/vocabulary';
import dayjs from 'dayjs';

import type { TimeFormat } from './date-format';

export function isValidHHmm(time: string): boolean {
  return timeOfDaySchema.safeParse(time).success;
}

export function getHour(time: string): number {
  return Number(time.split(':')[0]);
}

export function getMinute(time: string): number {
  return Number(time.split(':')[1]);
}

function withTime(date: Date, hour: number, minute: number): Date {
  return dayjs(date).hour(hour).minute(minute).second(0).millisecond(0).toDate();
}

/** 시간 문자열이 없거나 유효하지 않으면 fallbackTime을 쓴다(fallbackTime은 항상 유효한 상수라고 가정) */
export function getDateWithTime(date: Date, time: string | undefined, fallbackTime: string): Date {
  const safe = time != null && isValidHHmm(time) ? time : fallbackTime;
  return withTime(date, getHour(safe), getMinute(safe));
}

export function getTodayAt(hour: number, minute: number): Date {
  return withTime(new Date(), hour, minute);
}

/** 24시간제는 en_GB로 강제해 오전/오후 없는 스피너를 쓴다 */
export function getPickerLocale(
  resolvedLanguage: SupportedLocale,
  timeFormat: TimeFormat = 'TWELVE_HOUR',
): string {
  if (timeFormat !== 'TWELVE_HOUR') {
    return 'en_GB';
  }
  return resolvedLanguage === 'en' ? 'en_US' : 'ko';
}
