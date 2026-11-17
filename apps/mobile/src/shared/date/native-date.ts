import { type Instant, toEpochMs } from './instant';
import type { TimeOfDay } from './time-of-day';

// Date가 드나드는 유일한 경계다. 네이티브 피커·달력·Intl·위젯 타임라인이 Date를 주고받는다

export function toNativeDate(epochMs: number): Date {
  return new Date(epochMs);
}

export function isValidDate(date: Date): boolean {
  return Number.isFinite(date.getTime());
}

export function instantToDate(instant: Instant): Date {
  return toNativeDate(toEpochMs(instant));
}

/** 시와 분만 주고받는 피커의 시간대. 피커와 JS가 같은 고정 시간대로 읽어 기기 시간대가 바뀌어도 고른 시각이 그대로다 */
export const PICKER_TIME_ZONE = 'UTC';

/** 피커가 PICKER_TIME_ZONE 벽시계로 돌려준 Date의 시와 분 */
export function getPickerTimeOfDay(date: Date): TimeOfDay {
  return { hour: date.getUTCHours(), minute: date.getUTCMinutes() };
}

// 날짜는 아무 날이나 같다. 피커가 날짜를 보이지 않고 UTC에는 서머타임 전환이 없다
const PICKER_REFERENCE_DATE = { year: 2000, monthIndex: 0, day: 15 } as const;

/** 시와 분만 고르는 피커에 넘기는 Date. 피커에 timeZoneName={PICKER_TIME_ZONE}을 함께 넘긴다 */
export function toPickerDate({ hour, minute }: TimeOfDay): Date {
  const { year, monthIndex, day } = PICKER_REFERENCE_DATE;
  return toNativeDate(Date.UTC(year, monthIndex, day, hour, minute));
}
