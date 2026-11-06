import dayjs from 'dayjs';
import { z } from 'zod';

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

/** 어느 시간대에서든 같은 하나의 순간. 오프셋이 달라도 되는 ISO 8601 문자열이라 구조 공유가 된다 */
export const instantSchema = z.iso.datetime({ offset: true }).brand<'Instant'>();
export type Instant = z.infer<typeof instantSchema>;

/** 순간으로 읽을 수 없는 문자열은 던진다. 서버·저장소 경계에서 한 번만 부른다 */
export function toInstant(value: string): Instant {
  return instantSchema.parse(value);
}

/** 에포크 밀리초에서 순간을 만든다 */
export function fromEpochMs(ms: number): Instant {
  return toInstant(new Date(ms).toISOString());
}

/** 에포크 밀리초. 오프셋이 달라도 같은 순간이면 같은 값이다 */
export function toEpochMs(instant: Instant): number {
  return Date.parse(instant);
}

/** 문자열 사전순이 아니라 순간으로 비교한다. 오프셋이 달라도 맞다 */
export function isBefore(instant: Instant, other: Instant): boolean {
  return toEpochMs(instant) < toEpochMs(other);
}

/** 앞 값에서 뒤 값을 뺀 밀리초 */
export function diffMs(instant: Instant, other: Instant): number {
  return toEpochMs(instant) - toEpochMs(other);
}

export function toDate(date: Date | string | number): Date {
  const parsed = dayjs(date);
  return parsed.isValid() ? parsed.toDate() : new Date(date);
}

/** 순간이 그 시간대에서 놓인 달력 날짜(YYYY-MM-DD) */
export function toDateKey(value: Date | Instant, timeZone: string): string {
  const date = toDate(value);
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

export function getZonedHour(value: Date | Instant, timeZone: string): number {
  const date = toDate(value);
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
export function toHHmm(value: Date | Instant, timeZone: string): string {
  const date = toDate(value);
  if (!isValidDate(date)) {
    return '';
  }
  const parts = getFormatter({ locale: PARTS_LOCALE, timeZone }, ZONED_TIME_OPTIONS).formatToParts(
    date,
  );
  return `${findPart(parts, 'hour')}:${findPart(parts, 'minute')}`;
}

/** 같은 순간의 벽시계(날짜·시·분)가 두 시간대에서 같은지. 이름이 달라도 오프셋이 같으면(서울·도쿄) 같다. */
export function hasSameWallClock(
  value: Date | Instant,
  timeZone: string,
  otherTimeZone: string,
): boolean {
  const date = toDate(value);
  if (!isValidDate(date)) {
    return true;
  }
  const read = (zone: string) =>
    getFormatter({ locale: PARTS_LOCALE, timeZone: zone }, WALL_CLOCK_OPTIONS).format(date);
  return read(timeZone) === read(otherTimeZone);
}
