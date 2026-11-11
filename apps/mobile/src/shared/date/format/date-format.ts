import type { TIME_FORMATS } from '@aido/api/vocabulary';
import { DAY_MS, HOUR_MS, MINUTE_MS } from '@src/shared/constants/time-units';
import type { IntlLocale } from '@src/shared/i18n/app-locales';
import { match } from 'ts-pattern';

import { isSameMonthDateKey, isSameYearDateKey } from '../date-key';
import { diffMs, type Instant } from '../instant';
import { instantToDate, isValidDate, toNativeDate } from '../native-date';
import { isValidHHmm, type TimeOfDay, toTimeOfDay } from '../time-of-day';
import { getZonedHour, toDateKey } from '../zoned';
import { getFormatter, getPartValue, PARTS_LOCALE } from './intl-formatter';

/** 표시 언어(locale)는 글자 모양만, 시간대(timeZone)는 날짜·시각 계산만 정한다. */
export interface DateFormatContext {
  locale: IntlLocale;
  timeZone: string;
}

export type TimeFormat = (typeof TIME_FORMATS)[number];

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
  return getPartValue(parts, 'day');
}

function toUtcContext(context: DateFormatContext): DateFormatContext {
  return { ...context, timeZone: 'UTC' };
}

function toUtcMidnight(dateKey: string): Date {
  return toNativeDate(Date.parse(`${dateKey}T00:00:00Z`));
}

function toUtcDateAtTime({ hour, minute }: TimeOfDay): Date {
  return toNativeDate(Date.UTC(1970, 0, 1, hour, minute));
}

function toFormatDate(value: Date | Instant): Date {
  return value instanceof Date ? value : instantToDate(value);
}

function getHourCycleOptions(timeFormat: TimeFormat): Intl.DateTimeFormatOptions {
  return timeFormat === 'TWELVE_HOUR' ? { hour12: true } : { hourCycle: 'h23' };
}

export function formatDateLabel(
  value: Date | Instant,
  kind: DateLabel,
  context: DateFormatContext,
): string {
  const date = toFormatDate(value);
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
      return `${getPartValue(parts, 'month')}.${getPartValue(parts, 'day')}`;
    })
    .otherwise(() => getFormatter(context, DATE_OPTIONS[kind]).format(date));
}

export function formatDateKeyLabel(
  dateKey: string,
  kind: DateLabel,
  context: DateFormatContext,
): string {
  return formatDateLabel(toUtcMidnight(dateKey), kind, toUtcContext(context));
}

/** 오늘(사용자 시간대의 날짜 key)과 같은 해의 날만 연도를 뺀다. 지난해·내년 날짜는 연도까지 보여야 헷갈리지 않는다 */
function toYearAwareDateLabel(dateKeys: readonly string[], todayDateKey: string): DateLabel {
  return dateKeys.every((dateKey) => isSameYearDateKey(dateKey, todayDateKey))
    ? 'monthDay'
    : 'fullDate';
}

/** 올해면 "1월 5일", 올해가 아니면 "2027년 1월 5일". 순간의 해는 context 시간대로 읽는다 */
export function formatYearAwareDateLabel(
  value: Date | Instant,
  todayDateKey: string,
  context: DateFormatContext,
): string {
  const kind = toYearAwareDateLabel([toDateKey(value, context.timeZone)], todayDateKey);
  return formatDateLabel(value, kind, context);
}

export function formatYearAwareDateKeyLabel(
  dateKey: string,
  todayDateKey: string,
  context: DateFormatContext,
): string {
  return formatDateKeyLabel(dateKey, toYearAwareDateLabel([dateKey], todayDateKey), context);
}

/** 두 끝이 모두 올해면 월·일만, 하나라도 올해가 아니면 둘 다 연도까지 쓴다 */
export function formatDateKeyRange(
  startDateKey: string,
  endDateKey: string,
  todayDateKey: string,
  context: DateFormatContext,
): string {
  const kind = toYearAwareDateLabel([startDateKey, endDateKey], todayDateKey);
  return `${formatDateKeyLabel(startDateKey, kind, context)} ~ ${formatDateKeyLabel(endDateKey, kind, context)}`;
}

export function formatDateKeyCompactRange(
  startDateKey: string,
  endDateKey: string,
  todayDateKey: string,
  context: DateFormatContext,
): string {
  if (toYearAwareDateLabel([startDateKey, endDateKey], todayDateKey) === 'fullDate') {
    return formatDateKeyRange(startDateKey, endDateKey, todayDateKey, context);
  }
  const endLabel = isSameMonthDateKey(startDateKey, endDateKey)
    ? getFormatter(toUtcContext(context), DATE_OPTIONS.dayNumber).format(toUtcMidnight(endDateKey))
    : formatDateKeyLabel(endDateKey, 'monthDay', context);
  return `${formatDateKeyLabel(startDateKey, 'monthDay', context)}~${endLabel}`;
}

/** 오전/오후와 시각이 줄바꿈으로 갈라지지 않게 사이를 줄바꿈 없는 공백으로 잇는다 */
function keepTimeTogether(label: string): string {
  return label.replace(/ /g, '\u00A0');
}

export function formatClockTime(
  value: Date | Instant,
  timeFormat: TimeFormat,
  context: DateFormatContext,
): string {
  const date = toFormatDate(value);
  if (!isValidDate(date)) {
    return '';
  }
  return keepTimeTogether(
    getFormatter(context, {
      hour: 'numeric',
      minute: '2-digit',
      ...getHourCycleOptions(timeFormat),
    }).format(date),
  );
}

export function formatTimeOfDay(
  time: TimeOfDay,
  timeFormat: TimeFormat,
  context: DateFormatContext,
): string {
  return formatClockTime(toUtcDateAtTime(time), timeFormat, toUtcContext(context));
}

export function formatHourLabel(
  hour: number,
  timeFormat: TimeFormat,
  context: DateFormatContext,
): string {
  const date = toUtcDateAtTime({ hour, minute: 0 });
  if (!isValidDate(date)) {
    return '';
  }
  return keepTimeTogether(
    getFormatter(toUtcContext(context), {
      hour: 'numeric',
      ...getHourCycleOptions(timeFormat),
    }).format(date),
  );
}

/** 순간이 놓인 시각을 정시로 표시한다. 시는 context 시간대로 읽는다 (서울 15:20 → "오후 3시"). */
export function formatInstantHour(
  date: Date | Instant,
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
export function formatRelativeTimeWith(
  date: Instant,
  now: Instant,
  labels: RelativeTimeLabels,
  context: DateFormatContext,
): string {
  const elapsedMs = diffMs(now, date);
  if (Number.isNaN(elapsedMs)) {
    return '';
  }
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
  const isSameYear = isSameYearDateKey(
    toDateKey(date, context.timeZone),
    toDateKey(now, context.timeZone),
  );
  return formatDateLabel(date, isSameYear ? 'monthDay' : 'numericDate', context);
}

export function formatHHmmTime(
  time: string,
  timeFormat: TimeFormat,
  context: DateFormatContext,
): string {
  if (!isValidHHmm(time)) {
    return time;
  }
  return formatTimeOfDay(toTimeOfDay(time), timeFormat, context);
}
