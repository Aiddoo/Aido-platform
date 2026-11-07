import { fromDate, type Instant, toDate } from '@src/shared/date/instant';

/** 달력 입력 값을 느슨하게 읽는다. 없거나 읽을 수 없으면 던지지 않고 null이다 */
export function parseInstantOrNull(date?: Date | string | number | null): Instant | null {
  if (date == null) {
    return null;
  }

  const parsed = toDate(date);
  return Number.isNaN(parsed.getTime()) ? null : fromDate(parsed);
}
