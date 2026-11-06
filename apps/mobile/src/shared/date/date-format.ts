import type { TIME_FORMATS } from '@aido/api/vocabulary';
import { DAY_MS, HOUR_MS, MINUTE_MS } from '@src/shared/constants/time.constants';
import type { ResolvedLanguage } from '@src/shared/preferences/language.preference';
import { match } from 'ts-pattern';

import { getZonedHour, type Instant, toDate, toDateKey } from './instant';
import { findPart, getFormatter, isValidDate, PARTS_LOCALE } from './intl-formatter';
import { isValidHHmm, parseHour, parseMinute } from './time-of-day';

/** 표시 언어(locale)는 글자 모양만, 시간대(timeZone)는 날짜·시각 계산만 정한다. */
export interface DateFormatContext {
  locale: 'ko-KR' | 'en-US';
  timeZone: string;
}

export function toDateFormatLocale(language: ResolvedLanguage): DateFormatContext['locale'] {
  return language === 'ko' ? 'ko-KR' : 'en-US';
}

export type TimeFormat = (typeof TIME_FORMATS)[number];

/** 시간대와 무관한 하루 중 시각 (0-23시, 0-59분) */
export interface TimeOfDay {
  hour: number;
  minute: number;
}

type DateLabel =
  | 'fullDate'
  | 'monthDay'
  | 'numericDate'
  | 'dottedMonthDay'
  | 'dayNumber'
  | 'yearMonth'
  | 'yearShortMonth'
  | 'month'
  | 'weekday';

const DATE_OPTIONS: Record<DateLabel, Intl.DateTimeFormatOptions> = {
  fullDate: { year: 'numeric', month: 'long', day: 'numeric' },
  monthDay: { month: 'short', day: 'numeric' },
  numericDate: { year: 'numeric', month: 'numeric', day: 'numeric' },
  dottedMonthDay: { month: '2-digit', day: '2-digit' },
  dayNumber: { day: 'numeric' },
  yearMonth: { year: 'numeric', month: 'long' },
  yearShortMonth: { year: 'numeric', month: 'short' },
  month: { month: 'short' },
  weekday: { weekday: 'short' },
};

// Hermes(iOS)는 ko-KR day 파트에 "일"까지 붙여 주므로 숫자만 필요한 곳은 en-US 파트에서 읽는다
function formatNumericDay(date: Date, context: DateFormatContext): string {
  const parts = getFormatter(
    { ...context, locale: PARTS_LOCALE },
    DATE_OPTIONS.dayNumber,
  ).formatToParts(date);
  return findPart(parts, 'day');
}

function toUtcContext(context: DateFormatContext): DateFormatContext {
  return { ...context, timeZone: 'UTC' };
}

function toDateKeyInstant(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00Z`);
}

function toTimeOfDayInstant({ hour, minute }: TimeOfDay): Date {
  return new Date(Date.UTC(1970, 0, 1, hour, minute));
}

function getHourCycleOptions(timeFormat: TimeFormat): Intl.DateTimeFormatOptions {
  return timeFormat === 'TWELVE_HOUR' ? { hour12: true } : { hourCycle: 'h23' };
}

export function formatDateLabel(
  value: Date | Instant,
  kind: DateLabel,
  context: DateFormatContext,
): string {
  const date = toDate(value);
  if (!isValidDate(date)) {
    return '';
  }
  return match(kind)
    .with('dayNumber', () => formatNumericDay(date, context))
    .with('dottedMonthDay', () => {
      const parts = getFormatter(
        { ...context, locale: PARTS_LOCALE },
        DATE_OPTIONS.dottedMonthDay,
      ).formatToParts(date);
      return `${findPart(parts, 'month')}.${findPart(parts, 'day')}`;
    })
    .otherwise(() => getFormatter(context, DATE_OPTIONS[kind]).format(date));
}

/** YYYY-MM-DD 날짜 key를 기기 시간대와 무관하게 그 날짜 그대로 표시한다. */
export function formatDateKeyLabel(
  dateKey: string,
  kind: DateLabel,
  context: DateFormatContext,
): string {
  return formatDateLabel(toDateKeyInstant(dateKey), kind, toUtcContext(context));
}

/** YYYY-MM-DD 기간을 표시한다. 같은 해면 월·일만, 해가 다르면 연도까지 (ko: "10월 19일 ~ 10월 25일"). */
export function formatDateKeyRange(
  startDateKey: string,
  endDateKey: string,
  context: DateFormatContext,
): string {
  const kind: DateLabel =
    startDateKey.slice(0, 4) === endDateKey.slice(0, 4) ? 'monthDay' : 'fullDate';
  return `${formatDateKeyLabel(startDateKey, kind, context)} ~ ${formatDateKeyLabel(endDateKey, kind, context)}`;
}

export function formatDateKeyCompactRange(
  startDateKey: string,
  endDateKey: string,
  context: DateFormatContext,
): string {
  if (startDateKey.slice(0, 4) !== endDateKey.slice(0, 4)) {
    return formatDateKeyRange(startDateKey, endDateKey, context);
  }
  const endLabel =
    startDateKey.slice(0, 7) === endDateKey.slice(0, 7)
      ? getFormatter(toUtcContext(context), DATE_OPTIONS.dayNumber).format(
          toDateKeyInstant(endDateKey),
        )
      : formatDateKeyLabel(endDateKey, 'monthDay', context);
  return `${formatDateKeyLabel(startDateKey, 'monthDay', context)}~${endLabel}`;
}

/** 로케일 순서의 시:분 (ko: "오전 8:30", en: "8:30 AM", 24시간제: "18:30"). */
export function formatClockTime(
  date: Date,
  timeFormat: TimeFormat,
  context: DateFormatContext,
): string {
  if (!isValidDate(date)) {
    return '';
  }
  return getFormatter(context, {
    hour: 'numeric',
    minute: '2-digit',
    ...getHourCycleOptions(timeFormat),
  }).format(date);
}

/** 시간대와 무관한 시각을 로케일 순서로 표시한다 (ko: "오후 2:30", en: "2:30 PM"). */
export function formatTimeOfDay(
  time: TimeOfDay,
  timeFormat: TimeFormat,
  context: DateFormatContext,
): string {
  return formatClockTime(toTimeOfDayInstant(time), timeFormat, toUtcContext(context));
}

/** 정시를 로케일 순서로 표시한다 (ko: "오후 3시"/"15시", en: "3 PM"/"15"). */
export function formatHourLabel(
  hour: number,
  timeFormat: TimeFormat,
  context: DateFormatContext,
): string {
  const date = toTimeOfDayInstant({ hour, minute: 0 });
  if (!isValidDate(date)) {
    return '';
  }
  return getFormatter(toUtcContext(context), {
    hour: 'numeric',
    ...getHourCycleOptions(timeFormat),
  }).format(date);
}

/** 순간이 놓인 시각을 정시로 표시한다. 시는 context 시간대로 읽는다 (서울 15:20 → "오후 3시"). */
export function formatInstantHour(
  date: Date,
  timeFormat: TimeFormat,
  context: DateFormatContext,
): string {
  return formatHourLabel(getZonedHour(date, context.timeZone), timeFormat, context);
}

const RELATIVE_DAY_LIMIT = 7;

export interface RelativeTimeLabels {
  justNow: string;
  minutesAgo: (count: number) => string;
  hoursAgo: (count: number) => string;
  daysAgo: (count: number) => string;
}

/**
 * 경과 시간을 표시한다. 1분 미만·7일 미만은 주입한 문구("방금 전", "5분 전", "3시간 전", "2일 전"),
 * 그 이후는 같은 해면 "1월 5일", 다른 해면 "2025. 1. 5." (연도는 context 시간대 기준).
 */
export function formatRelativeTime(
  date: Date,
  now: Date,
  labels: RelativeTimeLabels,
  context: DateFormatContext,
): string {
  if (!isValidDate(date) || !isValidDate(now)) {
    return '';
  }
  const elapsedMs = now.getTime() - date.getTime();
  if (elapsedMs < MINUTE_MS) {
    return labels.justNow;
  }
  if (elapsedMs < HOUR_MS) {
    return labels.minutesAgo(Math.floor(elapsedMs / MINUTE_MS));
  }
  if (elapsedMs < DAY_MS) {
    return labels.hoursAgo(Math.floor(elapsedMs / HOUR_MS));
  }
  if (elapsedMs < RELATIVE_DAY_LIMIT * DAY_MS) {
    return labels.daysAgo(Math.floor(elapsedMs / DAY_MS));
  }
  const isSameYear =
    toDateKey(date, context.timeZone).slice(0, 4) === toDateKey(now, context.timeZone).slice(0, 4);
  return formatDateLabel(date, isSameYear ? 'monthDay' : 'numericDate', context);
}

/** "HH:mm" 문자열을 사용자 시간 형식에 맞춰 표시한다 */
export function formatTimeDisplay(
  time: string,
  timeFormat: TimeFormat,
  context: DateFormatContext,
): string {
  if (!isValidHHmm(time)) {
    return time;
  }
  return formatTimeOfDay({ hour: parseHour(time), minute: parseMinute(time) }, timeFormat, context);
}
