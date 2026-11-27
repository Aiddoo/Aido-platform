import type { TIME_FORMATS } from '@aido/api/vocabulary';
import { DAY_MS, HOUR_MS, MINUTE_MS } from '@src/shared/constants/time-units';
import type { IntlLocale } from '@src/shared/i18n/app-locales';
import { match } from 'ts-pattern';

import { type DateKey, diffDateKeysInDays, isSameYearDateKey } from '../date-key';
import { diffMs, type Instant } from '../instant';
import { instantToDate, isValidDate, toNativeDate } from '../native-date';
import { isValidHHmm, type TimeOfDay, toTimeOfDay } from '../time-of-day';
import { getZonedHour, toDateKey } from '../zoned';
import { getFormatter, getPartsFormatter, getPartValue } from './intl-formatter';

/** 표시 언어(locale)는 글자 모양만, 시간대(timezone)는 날짜·시각 계산만 정한다. */
export interface DateFormatContext {
  locale: IntlLocale;
  timezone: string;
}

export type TimeFormat = (typeof TIME_FORMATS)[number];

type DateLabel =
  | 'fullDate'
  | 'monthDay'
  | 'monthDayYear'
  | 'dottedMonthDay'
  | 'day'
  | 'dayNumber'
  | 'yearMonth'
  | 'yearShortMonth'
  | 'month'
  | 'weekday'
  | 'year';

const DATE_OPTIONS: Record<DateLabel, Intl.DateTimeFormatOptions> = {
  fullDate: { year: 'numeric', month: 'long', day: 'numeric' },
  monthDay: { month: 'short', day: 'numeric' },
  monthDayYear: { year: 'numeric', month: 'short', day: 'numeric' },
  dottedMonthDay: { month: '2-digit', day: '2-digit' },
  day: { day: 'numeric' },
  dayNumber: { day: 'numeric' },
  yearMonth: { year: 'numeric', month: 'long' },
  yearShortMonth: { year: 'numeric', month: 'short' },
  month: { month: 'short' },
  weekday: { weekday: 'short' },
  year: { year: 'numeric' },
};

const MID_YEAR_MONTH_INDEX = 6;

// Hermes(iOS)는 ko-KR day 파트에 "일"까지 붙여 주므로 숫자만 필요한 곳은 en-US 파트에서 읽는다
function formatNumericDay(date: Date, context: DateFormatContext): string {
  const parts = getPartsFormatter(context.timezone, DATE_OPTIONS.dayNumber).formatToParts(date);
  return getPartValue(parts, 'day');
}

/** 날짜 key·시각만 있는 값은 UTC 자정에 놓고 UTC로 그려 기기 시간대가 날짜를 옮기지 않게 한다 */
const WALL_CLOCK_TIMEZONE = 'UTC';

function toUtcContext(context: DateFormatContext): DateFormatContext {
  return { ...context, timezone: WALL_CLOCK_TIMEZONE };
}

function toUtcMidnight(dateKey: DateKey): Date {
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
      const parts = getPartsFormatter(context.timezone, DATE_OPTIONS.dottedMonthDay).formatToParts(
        date,
      );
      return `${getPartValue(parts, 'month')}.${getPartValue(parts, 'day')}`;
    })
    .otherwise(() => getFormatter(context, DATE_OPTIONS[kind]).format(date));
}

export function formatDateKeyLabel(
  dateKey: DateKey,
  kind: DateLabel,
  context: DateFormatContext,
): string {
  return formatDateLabel(toUtcMidnight(dateKey), kind, toUtcContext(context));
}

/** 연도 숫자만 있는 라벨(ko "2026년", en "2026"). 해 가운데 날을 UTC로 읽어 시간대가 해를 바꾸지 않는다 */
export function formatYearLabel(year: number, context: DateFormatContext): string {
  return formatDateLabel(
    toNativeDate(Date.UTC(year, MID_YEAR_MONTH_INDEX, 1)),
    'year',
    toUtcContext(context),
  );
}

/** 오늘(사용자 시간대의 날짜 key)과 같은 해의 날만 연도를 뺀다. 지난해·내년 날짜는 연도까지 보여야 헷갈리지 않는다 */
export function getYearAwareDateLabel(
  dateKeys: readonly DateKey[],
  todayDateKey: DateKey,
): 'monthDay' | 'monthDayYear' {
  return dateKeys.every((dateKey) => isSameYearDateKey(dateKey, todayDateKey))
    ? 'monthDay'
    : 'monthDayYear';
}

/** 올해면 "1월 5일"·"Jan 5", 올해가 아니면 "2027년 1월 5일"·"Jan 5, 2027". 순간의 해는 context 시간대로 읽는다 */
export function formatYearAwareDateLabel(
  value: Date | Instant,
  todayDateKey: DateKey,
  context: DateFormatContext,
): string {
  if (!isValidDate(toFormatDate(value))) {
    return '';
  }
  const kind = getYearAwareDateLabel([toDateKey(value, context.timezone)], todayDateKey);
  return formatDateLabel(value, kind, context);
}

export function formatYearAwareDateKeyLabel(
  dateKey: DateKey,
  todayDateKey: DateKey,
  context: DateFormatContext,
): string {
  return formatDateKeyLabel(dateKey, getYearAwareDateLabel([dateKey], todayDateKey), context);
}

/** 오전/오후와 시각이 줄바꿈으로 갈라지지 않게 사이를 줄바꿈 없는 공백으로 잇는다 */
function keepTimeTogether(label: string): string {
  return label.replaceAll(' ', '\u00A0');
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

const BARE_NUMBER = /^\d+$/;

/** 정시를 시 단위로 쓴다(ko "오후 3시"·"15시", en "3 PM"). en 24시간제처럼 시 단위 글자가 없으면 "15:00"으로 쓴다 */
export function formatHourLabel(
  hour: number,
  timeFormat: TimeFormat,
  context: DateFormatContext,
): string {
  const date = toUtcDateAtTime({ hour, minute: 0 });
  if (!isValidDate(date)) {
    return '';
  }
  const label = getFormatter(toUtcContext(context), {
    hour: 'numeric',
    ...getHourCycleOptions(timeFormat),
  }).format(date);
  // 숫자만 남으면 "15쯤 그쳐요"처럼 문장에서 시각으로 읽히지 않는다
  if (BARE_NUMBER.test(label)) {
    return formatTimeOfDay({ hour, minute: 0 }, timeFormat, context);
  }
  return keepTimeTogether(label);
}

/** 순간이 놓인 시각을 정시로 표시한다. 시는 context 시간대로 읽는다 (서울 15:20 → "오후 3시"). */
export function formatInstantHour(
  date: Date | Instant,
  timeFormat: TimeFormat,
  context: DateFormatContext,
): string {
  return formatHourLabel(getZonedHour(date, context.timezone), timeFormat, context);
}

const RELATIVE_DAY_LIMIT = 7;

export interface RelativeTimeLabels {
  justNow: string;
  minutesAgo: (count: number) => string;
  hoursAgo: (count: number) => string;
  yesterday: string;
  daysAgo: (count: number) => string;
}

/** 하루 뒤부터는 context 시간대의 달력 날짜로 센 일수("어제", "2일 전")이고, 7일부터는 year-aware 날짜다 */
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
  const todayDateKey = toDateKey(now, context.timezone);
  const elapsedDays = diffDateKeysInDays(toDateKey(date, context.timezone), todayDateKey);
  // 25시간인 서머타임 해제일은 24시간이 지나도 같은 날일 수 있다
  if (elapsedMs < DAY_MS || elapsedDays < 1) {
    return labels.hoursAgo(Math.floor(elapsedMs / HOUR_MS));
  }
  if (elapsedDays === 1) {
    return labels.yesterday;
  }
  if (elapsedDays < RELATIVE_DAY_LIMIT) {
    return labels.daysAgo(elapsedDays);
  }
  return formatYearAwareDateLabel(date, todayDateKey, context);
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
