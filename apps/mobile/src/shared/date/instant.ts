import { MINUTE_MS } from '@src/shared/constants/time-units';
import dayjs from 'dayjs';
import { z } from 'zod';

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

/** 어느 시간대에서든 같은 하나의 순간. 오프셋이 달라도 되는 ISO 8601 문자열이라 구조 공유가 된다 */
export const instantSchema = z.iso.datetime({ offset: true }).brand<'Instant'>();
export type Instant = z.infer<typeof instantSchema>;

/** 폼 값처럼 입력과 출력의 타입이 같아야 하는 곳의 순간 스키마. brand는 입력 타입에 남지 않아 따로 둔다 */
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

/** 지금 이 순간. 렌더 중에는 쓰지 않고 이벤트·저장 시점에 부른다 */
export function getNowInstant(): Instant {
  return fromEpochMs(Date.now());
}

/** 에포크 밀리초에서 순간을 만든다 */
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

export function toDate(date: Date | string | number): Date {
  return dayjs(date).toDate();
}

/** 그 순간에 그 시간대의 벽시계가 UTC보다 앞선 밀리초 */
function getZoneOffsetMs(epochMs: number, timeZone: string): number {
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

/**
 * 그 시간대의 날짜(YYYY-MM-DD)와 벽시계(HH:mm)가 가리키는 순간.
 * dayjs.tz는 iOS Hermes에서 분이 어긋난 순간을 돌려줘(오전 9:00 → 9:17) 다른 함수와 같은 Intl 파트로 오프셋을 구한다.
 * 서머타임 경계는 오프셋을 한 번 더 구해 맞춘다
 */
export function fromWallClock(dateKey: string, hhmm: string, timeZone: string): Instant {
  const wallClockAsUtc = Date.parse(`${dateKey}T${hhmm.slice(0, 5)}:00Z`);
  const firstGuess = wallClockAsUtc - getZoneOffsetMs(wallClockAsUtc, timeZone);
  return fromEpochMs(wallClockAsUtc - getZoneOffsetMs(firstGuess, timeZone));
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

/** 순간이 그 시간대에서 놓인 벽시계(HH:mm) */
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
