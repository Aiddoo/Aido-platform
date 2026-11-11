import { type Instant } from '@src/shared/date/instant';
import { instantFromDate, isValidDate, toLocalDay } from '@src/shared/date/native-date';

/** 날짜 key를 폼의 그날 0시 순간으로 느슨하게 읽는다. 없거나 읽을 수 없으면 던지지 않고 null이다 */
export function parseInstant(dateKey: string | null): Instant | null {
  if (dateKey == null) {
    return null;
  }

  const parsed = toLocalDay(dateKey);
  return isValidDate(parsed) ? instantFromDate(parsed) : null;
}
