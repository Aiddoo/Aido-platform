import { type DateKey, dateKeySchema } from '@src/shared/date/date-key';

/** 테스트의 날짜 리터럴을 날짜 key로 읽는다. 없는 날이면 던져 잘못 쓴 리터럴을 바로 드러낸다 */
export function createDateKey(value: string): DateKey {
  return dateKeySchema.parse(value);
}
