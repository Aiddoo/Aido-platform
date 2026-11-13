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

/** 피커가 기기 시간대 벽시계로 돌려준 Date의 시와 분 */
export function getPickerTimeOfDay(date: Date): TimeOfDay {
  return { hour: date.getHours(), minute: date.getMinutes() };
}

// 서머타임 전환이 없는 고정 날짜다. 오늘에 두면 전환일에 02:30이 03:30으로 밀리고 렌더마다 시계를 읽는다
const PICKER_REFERENCE_DATE = { year: 2000, monthIndex: 0, day: 15 } as const;

/** 시와 분만 고르는 피커에 넘기는 Date */
export function toPickerDate({ hour, minute }: TimeOfDay): Date {
  const { year, monthIndex, day } = PICKER_REFERENCE_DATE;
  return new Date(year, monthIndex, day, hour, minute);
}
