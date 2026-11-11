import { type DateKey, toCivilDate } from './date-key';
import { fromEpochMs, type Instant, toEpochMs } from './instant';
import { isValidHHmm, type TimeOfDay, toTimeOfDay } from './time-of-day';

// Date가 드나드는 유일한 경계다. 네이티브 피커·달력·Intl·위젯 타임라인이 Date를 주고받는다

export function toNativeDate(epochMs: number): Date {
  return new Date(epochMs);
}

export function isValidDate(date: Date): boolean {
  return Number.isFinite(date.getTime());
}

export function instantFromDate(date: Date): Instant {
  return fromEpochMs(date.getTime());
}

export function instantToDate(instant: Instant): Date {
  return toNativeDate(toEpochMs(instant));
}

/** 기기 시간대의 그날 0시. 날짜 계산은 key로 하고 Date는 마지막에 만들어야 자정·서머타임에 날이 밀리지 않는다 */
export function toLocalDay(dateKey: DateKey): Date {
  const { year, month, day } = toCivilDate(dateKey);
  return new Date(year, month - 1, day);
}

/** 피커가 기기 시간대 벽시계로 돌려준 Date의 시와 분 */
export function getPickerTimeOfDay(date: Date): TimeOfDay {
  return { hour: date.getHours(), minute: date.getMinutes() };
}

function withTime(date: Date, { hour, minute }: TimeOfDay): Date {
  const next = new Date(date);
  next.setHours(hour, minute, 0, 0);
  return next;
}

/** 시간 문자열이 없거나 유효하지 않으면 fallbackTime을 쓴다(fallbackTime은 항상 유효한 상수라고 가정) */
export function getDateWithTime(date: Date, time: string | undefined, fallbackTime: string): Date {
  const safe = time != null && isValidHHmm(time) ? time : fallbackTime;
  return withTime(date, toTimeOfDay(safe));
}

// 서머타임 전환이 없는 고정 날짜다. 오늘에 두면 전환일에 02:30이 03:30으로 밀리고 렌더마다 시계를 읽는다
const PICKER_REFERENCE_DATE = { year: 2000, monthIndex: 0, day: 15 } as const;

/** 시와 분만 고르는 피커에 넘기는 Date */
export function toPickerDate({ hour, minute }: TimeOfDay): Date {
  const { year, monthIndex, day } = PICKER_REFERENCE_DATE;
  return new Date(year, monthIndex, day, hour, minute);
}
