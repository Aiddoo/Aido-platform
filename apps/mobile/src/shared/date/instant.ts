import dayjs from 'dayjs';

import { findPart, getFormatter, isValidDate, PARTS_LOCALE } from './intl-formatter';

const DATE_KEY_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
};
const ZONED_HOUR_OPTIONS: Intl.DateTimeFormatOptions = { hour: '2-digit', hourCycle: 'h23' };
const ZONED_TIME_OPTIONS: Intl.DateTimeFormatOptions = { ...ZONED_HOUR_OPTIONS, minute: '2-digit' };
const WALL_CLOCK_OPTIONS: Intl.DateTimeFormatOptions = {
  ...DATE_KEY_OPTIONS,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
};

export function toDate(date: Date | string | number): Date {
  const parsed = dayjs(date);
  return parsed.isValid() ? parsed.toDate() : new Date(date);
}

/** 순간이 그 시간대에서 놓인 달력 날짜(YYYY-MM-DD) */
export function toDateKey(date: Date, timeZone: string): string {
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

/** 순간이 그 시간대에서 놓인 벽시계(HH:mm) */
export function toHHmm(date: Date, timeZone: string): string {
  if (!isValidDate(date)) {
    return '';
  }
  const parts = getFormatter({ locale: PARTS_LOCALE, timeZone }, ZONED_TIME_OPTIONS).formatToParts(
    date,
  );
  return `${findPart(parts, 'hour')}:${findPart(parts, 'minute')}`;
}

/** 같은 순간의 벽시계(날짜·시·분)가 두 시간대에서 같은지. 이름이 달라도 오프셋이 같으면(서울·도쿄) 같다. */
export function hasSameWallClock(date: Date, timeZone: string, otherTimeZone: string): boolean {
  if (!isValidDate(date)) {
    return true;
  }
  const read = (zone: string) =>
    getFormatter({ locale: PARTS_LOCALE, timeZone: zone }, WALL_CLOCK_OPTIONS).format(date);
  return read(timeZone) === read(otherTimeZone);
}
