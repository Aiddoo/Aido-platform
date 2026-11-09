import { MINUTE_MS } from '@src/shared/constants/time-units';
import dayjs from 'dayjs';
import { z } from 'zod';

import { diffDateKeysInDays } from './date-key';
import { getFormatter, getPartValue, isValidDate, PARTS_LOCALE } from './intl-formatter';

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

/** 오프셋이 달라도 되는 ISO 8601 문자열이라 구조 공유가 된다 */
export const instantSchema = z.iso.datetime({ offset: true }).brand<'Instant'>();
export type Instant = z.infer<typeof instantSchema>;

/** brand는 입력 타입에 남지 않아 폼용 스키마를 따로 둔다 */
export const instantFieldSchema = z.custom<Instant>(
  (value) => instantSchema.safeParse(value).success,
);

/** 순간으로 읽을 수 없는 문자열은 던진다. 서버·저장소 경계에서 한 번만 부른다 */
export function toInstant(value: string): Instant {
  return instantSchema.parse(value);
}

/** 서버·저장소의 선택 시각 칸을 순간으로 바꾼다. 없으면 null이다 */
export function toNullableInstant(value: string | null): Instant | null {
  return value == null ? null : toInstant(value);
}

/** 선택기처럼 Date를 쓰는 경계에서 받은 값을 순간으로 바꾼다 */
export function fromDate(date: Date): Instant {
  return toInstant(date.toISOString());
}

/** 렌더 중에는 쓰지 않고 이벤트·저장 시점에 부른다 */
export function getNowInstant(): Instant {
  return fromEpochMs(Date.now());
}

export function fromEpochMs(ms: number): Instant {
  return toInstant(new Date(ms).toISOString());
}

/** 에포크 밀리초. 오프셋이 달라도 같은 순간이면 같은 값이다 */
export function toEpochMs(instant: Instant): number {
  return Date.parse(instant);
}

/** 앞 값에서 뒤 값을 뺀 밀리초 */
export function diffMs(instant: Instant, other: Instant): number {
  return toEpochMs(instant) - toEpochMs(other);
}

/** 끝나는 시각 자체를 지난 것으로 본다 */
export function hasInstantPassed(instant: Instant, now: Instant): boolean {
  return toEpochMs(instant) <= toEpochMs(now);
}

/** 목표 순간까지 남은 분(올림). 이미 지났으면 0분이다 */
export function getMinutesUntil(target: Instant, now: Instant): number {
  return Math.max(0, Math.ceil(diffMs(target, now) / MINUTE_MS));
}

/** 끝나는 날까지 남은 달력 일수(시간대 기준). 이미 지난 날은 0일이다 */
export function calculateCalendarDaysLeft(endsAt: Instant, now: Instant, timeZone: string): number {
  return Math.max(diffDateKeysInDays(toDateKey(now, timeZone), toDateKey(endsAt, timeZone)), 0);
}

export function toDate(date: Date | string | number): Date {
  return dayjs(date).toDate();
}

/** 그 순간에 그 시간대의 벽시계가 UTC보다 앞선 밀리초 */
export function getZoneOffsetMs(epochMs: number, timeZone: string): number {
  const parts = getFormatter({ locale: PARTS_LOCALE, timeZone }, WALL_CLOCK_OPTIONS).formatToParts(
    new Date(epochMs),
  );
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(getPartValue(parts, type));
  const wallClockAsUtc = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour'),
    read('minute'),
  );
  return wallClockAsUtc - (epochMs - (epochMs % MINUTE_MS));
}

/** dayjs.tz는 iOS Hermes에서 분이 어긋나(오전 9:00 → 9:17) Intl 파트로 오프셋을 구하고, 서머타임 경계는 한 번 더 구해 맞춘다 */
export function fromWallClock(dateKey: string, hhmm: string, timeZone: string): Instant {
  const wallClockAsUtc = Date.parse(`${dateKey}T${hhmm.slice(0, 5)}:00Z`);
  const firstGuess = wallClockAsUtc - getZoneOffsetMs(wallClockAsUtc, timeZone);
  return fromEpochMs(wallClockAsUtc - getZoneOffsetMs(firstGuess, timeZone));
}

export function toDateKey(value: Date | Instant, timeZone: string): string {
  const date = toDate(value);
  if (!isValidDate(date)) {
    return '';
  }
  const parts = getFormatter({ locale: PARTS_LOCALE, timeZone }, DATE_KEY_OPTIONS).formatToParts(
    date,
  );
  const year = getPartValue(parts, 'year');
  const month = getPartValue(parts, 'month');
  const day = getPartValue(parts, 'day');
  return year && month && day ? `${year}-${month}-${day}` : '';
}

export function getZonedHour(value: Date | Instant, timeZone: string): number {
  const date = toDate(value);
  if (!isValidDate(date)) {
    return Number.NaN;
  }
  return Number(
    getPartValue(
      getFormatter({ locale: PARTS_LOCALE, timeZone }, ZONED_HOUR_OPTIONS).formatToParts(date),
      'hour',
    ),
  );
}

export function toHHmm(value: Date | Instant, timeZone: string): string {
  const date = toDate(value);
  if (!isValidDate(date)) {
    return '';
  }
  const parts = getFormatter({ locale: PARTS_LOCALE, timeZone }, ZONED_TIME_OPTIONS).formatToParts(
    date,
  );
  return `${getPartValue(parts, 'hour')}:${getPartValue(parts, 'minute')}`;
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
