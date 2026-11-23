import { DAY_MS, MINUTE_MS } from '@src/shared/constants/time-units';

import { addDaysToDateKey, type DateKey, diffDateKeysInDays, isDateKey } from './date-key';
import { getFormatter, getPartValue, PARTS_LOCALE } from './format/intl-formatter';
import { fromEpochMs, type Instant, toEpochMs } from './instant';
import { toNativeDate } from './native-date';

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

// 앱 모델은 Instant지만 네이티브 피커·파일 시각이 넘기는 Date도 같은 순간으로 읽는다
type ZonedInput = Date | Instant;

function getEpochMs(value: ZonedInput): number {
  return value instanceof Date ? value.getTime() : toEpochMs(value);
}

function formatParts(epochMs: number, timezone: string, options: Intl.DateTimeFormatOptions) {
  return getFormatter({ locale: PARTS_LOCALE, timezone }, options).formatToParts(
    toNativeDate(epochMs),
  );
}

/** 그 순간에 그 시간대의 벽시계가 UTC보다 앞선 밀리초 */
export function getZoneOffsetMs(epochMs: number, timezone: string): number {
  const parts = formatParts(epochMs, timezone, WALL_CLOCK_OPTIONS);
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
 * 서버 toZonedInstant와 같은 규칙으로 날짜 + 벽시계를 순간으로 바꾼다. 겹치는 시각은 앞쪽, 없는 시각은
 * 전환 뒤로 민다(Temporal "compatible"). Hermes에 Temporal이 없어 Intl 오프셋으로 계산한다
 */
export function toZonedInstant({
  date,
  time,
  timezone,
}: {
  date: DateKey;
  time: string;
  timezone: string;
}): Instant {
  const wallClockAsUtc = Date.parse(`${date}T${time.slice(0, 5)}:00Z`);
  const offsetBefore = getZoneOffsetMs(wallClockAsUtc - DAY_MS, timezone);
  const offsetAfter = getZoneOffsetMs(wallClockAsUtc + DAY_MS, timezone);
  const matches = [wallClockAsUtc - offsetBefore, wallClockAsUtc - offsetAfter].filter(
    (candidate) => candidate + getZoneOffsetMs(candidate, timezone) === wallClockAsUtc,
  );
  // 겹치면 둘 중 앞쪽, 하나면 그것, 없으면(건너뛴 시각) 전환 전 오프셋으로 읽어 전환 뒤로 민다
  return fromEpochMs(matches.length > 0 ? Math.min(...matches) : wallClockAsUtc - offsetBefore);
}

/** 잘못된 `Date`(NaN)는 날짜가 없어 던진다. `Instant`는 늘 유효하다 */
export function toDateKey(value: ZonedInput, timezone: string): DateKey {
  const parts = formatParts(getEpochMs(value), timezone, DATE_KEY_OPTIONS);
  const dateKey = `${getPartValue(parts, 'year')}-${getPartValue(parts, 'month')}-${getPartValue(parts, 'day')}`;
  if (!isDateKey(dateKey)) {
    throw new RangeError(`${timezone}에서 날짜 key로 읽을 수 없는 순간이다`);
  }
  return dateKey;
}

export function getZonedHour(value: ZonedInput, timezone: string): number {
  const epochMs = getEpochMs(value);
  if (!Number.isFinite(epochMs)) {
    return Number.NaN;
  }
  return Number(getPartValue(formatParts(epochMs, timezone, ZONED_HOUR_OPTIONS), 'hour'));
}

export function toHHmm(value: ZonedInput, timezone: string): string {
  const epochMs = getEpochMs(value);
  if (!Number.isFinite(epochMs)) {
    return '';
  }
  const parts = formatParts(epochMs, timezone, ZONED_TIME_OPTIONS);
  return `${getPartValue(parts, 'hour')}:${getPartValue(parts, 'minute')}`;
}

/** 같은 순간의 벽시계(날짜·시·분)가 두 시간대에서 같은지. 이름이 달라도 오프셋이 같으면(서울·도쿄) 같다. */
export function hasSameWallClock(
  value: ZonedInput,
  timezone: string,
  otherTimezone: string,
): boolean {
  const epochMs = getEpochMs(value);
  if (!Number.isFinite(epochMs)) {
    return true;
  }
  const read = (zone: string) =>
    getFormatter({ locale: PARTS_LOCALE, timezone: zone }, WALL_CLOCK_OPTIONS).format(
      toNativeDate(epochMs),
    );
  return read(timezone) === read(otherTimezone);
}

/** 끝나는 날까지 남은 달력 일수(시간대 기준). 이미 지난 날은 0일이다 */
export function calculateCalendarDaysLeft(endsAt: Instant, now: Instant, timezone: string): number {
  return Math.max(diffDateKeysInDays(toDateKey(now, timezone), toDateKey(endsAt, timezone)), 0);
}

/** 그 날짜가 시작하는 순간. 자정이 없거나 두 번 오는 날도 그 날의 첫 순간이다 */
export function getStartOfDateKey(dateKey: DateKey, timezone: string): Instant {
  return toZonedInstant({ date: dateKey, time: '00:00', timezone });
}

/** 자정이 없거나 두 번 오는 DST 날짜도 다음 날짜의 첫 순간이다 */
export function getNextLocalMidnight(now: Instant, timezone: string): Instant {
  return getStartOfDateKey(addDaysToDateKey(toDateKey(now, timezone), 1), timezone);
}
