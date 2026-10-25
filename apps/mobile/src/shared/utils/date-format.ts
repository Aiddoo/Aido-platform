import type { ResolvedLanguage } from '@src/shared/preferences/language.preference';
import { match } from 'ts-pattern';

/** 표시 언어(locale)는 글자 모양만, 시간대(timeZone)는 날짜·시각 계산만 정한다. */
export interface DateFormatContext {
  locale: 'ko-KR' | 'en-US';
  timeZone: string;
}

export function toDateFormatLocale(language: ResolvedLanguage): DateFormatContext['locale'] {
  return language === 'ko' ? 'ko-KR' : 'en-US';
}

export type TimeFormat = 'TWELVE_HOUR' | 'TWENTY_FOUR_HOUR';

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
  | 'month'
  | 'weekday';

const DATE_OPTIONS: Record<DateLabel, Intl.DateTimeFormatOptions> = {
  fullDate: { year: 'numeric', month: 'long', day: 'numeric' },
  monthDay: { month: 'short', day: 'numeric' },
  numericDate: { year: 'numeric', month: 'numeric', day: 'numeric' },
  dottedMonthDay: { month: '2-digit', day: '2-digit' },
  dayNumber: { day: 'numeric' },
  yearMonth: { year: 'numeric', month: 'long' },
  month: { month: 'short' },
  weekday: { weekday: 'short' },
};

const DATE_KEY_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
};
const ZONED_HOUR_OPTIONS: Intl.DateTimeFormatOptions = { hour: '2-digit', hourCycle: 'h23' };
const PARTS_LOCALE: DateFormatContext['locale'] = 'en-US';

const formatterCache = new Map<string, Intl.DateTimeFormat>();
const MAX_FORMATTERS = 32;

function getFormatter(
  context: DateFormatContext,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = JSON.stringify([context.locale, context.timeZone, options]);
  const cached = formatterCache.get(key);
  if (cached) {
    return cached;
  }

  if (formatterCache.size >= MAX_FORMATTERS) {
    formatterCache.clear();
  }
  const formatter = new Intl.DateTimeFormat(context.locale, {
    ...options,
    timeZone: context.timeZone,
  });
  formatterCache.set(key, formatter);
  return formatter;
}

function isValidDate(date: Date): boolean {
  return Number.isFinite(date.getTime());
}

function findPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? '';
}

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

export function formatDateLabel(date: Date, kind: DateLabel, context: DateFormatContext): string {
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

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
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
    formatDateKey(date, context.timeZone).slice(0, 4) ===
    formatDateKey(now, context.timeZone).slice(0, 4);
  return formatDateLabel(date, isSameYear ? 'monthDay' : 'numericDate', context);
}

export function formatDateKey(date: Date, timeZone: string): string {
  if (!isValidDate(date)) {
    return '';
  }
  const parts = getFormatter({ locale: PARTS_LOCALE, timeZone }, DATE_KEY_OPTIONS).formatToParts(
    date,
  );
  const year = findPart(parts, 'year');
  const month = findPart(parts, 'month');
  const day = findPart(parts, 'day');
  return year && month && day ? `${year}-${month}-${day}` : '';
}

/** 지정 시간대 기준 시(0-23) */
export function getZonedHour(date: Date, timeZone: string): number {
  if (!isValidDate(date)) {
    return Number.NaN;
  }
  return Number(
    findPart(
      getFormatter({ locale: PARTS_LOCALE, timeZone }, ZONED_HOUR_OPTIONS).formatToParts(date),
      'hour',
    ),
  );
}
