import { instantFromDate } from "#api/shared/domain/time/instant";

import { type CalendarDay, representableDay } from "./schedule-date.domain-service.js";
import type { DateRef, PartOfDay, TimeRef } from "./todo-draft.constants.js";

const HALF_DAY_MINUTES = 12 * 60;

/** 때만 말한 경우의 기본 시각(분). 자정은 대상 날짜 다음 날 00:00으로 따로 다룬다. */
const PART_OF_DAY_MINUTES: Readonly<Record<Exclude<PartOfDay, "MIDNIGHT">, number>> = {
  DAWN: 6 * 60,
  MORNING: 9 * 60,
  NOON: 12 * 60,
  AFTERNOON: 15 * 60,
  EVENING: 19 * 60,
  NIGHT: 21 * 60,
};

export interface ScheduleClock {
  readonly now: Date;
  readonly timeZone: string;
}

export interface TimeResolution {
  readonly day: CalendarDay;
  readonly minutes: number;
}

/** 시각을 정하는 기준. targetDay는 날짜 표현이 정한 날, today·nowMinutes는 사용자 시간대의 지금이다 */
export interface TimeBasis {
  readonly targetDay: CalendarDay;
  readonly today: CalendarDay;
  readonly nowMinutes: number;
  readonly clock: ScheduleClock;
}

/**
 * "N분 뒤"는 지금부터의 경과 시간이라 1분 이상이고 날짜를 말하지 않았거나 오늘일 때만 쓴다.
 * 0·음수, 또는 "내일"처럼 다른 날을 말한 표현과 함께 온 값은 무시하고 날짜·때를 따른다.
 */
export function isRelativeTime(ref: TimeRef, date: DateRef): boolean {
  return (
    ref.relativeMinutes != null &&
    ref.relativeMinutes > 0 &&
    (date.kind === "NONE" || date.kind === "TODAY")
  );
}

export function resolveTime(
  ref: TimeRef,
  isRelative: boolean,
  basis: TimeBasis,
): TimeResolution | "INVALID" | null {
  const { targetDay, clock } = basis;
  if (isRelative && ref.relativeMinutes != null) {
    // 벽시계 분에 더하면 DST 전환 구간에서 한 시간이 어긋나므로 실제 순간에 더한 뒤 현지로 바꾼다.
    const { relativeMinutes } = ref;
    const target = representableDay(() => {
      const local = instantFromDate(clock.now)
        .add({ minutes: relativeMinutes })
        .toZonedDateTimeISO(clock.timeZone);
      return { day: local.toPlainDate(), minutes: local.hour * 60 + local.minute };
    });
    return target ?? "INVALID";
  }
  if (ref.hour == null) {
    if (ref.partOfDay == null) {
      return null;
    }
    if (ref.partOfDay === "MIDNIGHT") {
      return { day: targetDay.add({ days: 1 }), minutes: 0 };
    }
    return { day: targetDay, minutes: PART_OF_DAY_MINUTES[ref.partOfDay] };
  }
  const minute = ref.minute ?? 0;
  if (!Number.isInteger(ref.hour) || ref.hour < 0 || ref.hour > 23) {
    return "INVALID";
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    return "INVALID";
  }
  const hour = ref.hour;

  if (ref.meridiem === "PM" && hour < 12) {
    return { day: targetDay, minutes: (hour + 12) * 60 + minute };
  }
  if (ref.meridiem === "AM" && hour === 12) {
    return { day: targetDay, minutes: minute };
  }
  if (ref.meridiem === "AM" || ref.meridiem === "PM" || hour === 0 || hour > 12) {
    return { day: targetDay, minutes: hour * 60 + minute };
  }
  return resolveAmbiguousHour({ hour, minute, partOfDay: ref.partOfDay }, basis);
}

export function formatMinutes(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  return `${String(hour).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** 오전/오후 단서가 없는 1~12시. */
function resolveAmbiguousHour(
  spoken: {
    readonly hour: number;
    readonly minute: number;
    readonly partOfDay: PartOfDay | null;
  },
  basis: TimeBasis,
): TimeResolution {
  const { hour, minute, partOfDay } = spoken;
  const { targetDay, today, nowMinutes } = basis;
  const morning = (hour % 12) * 60 + minute;
  const evening = morning + HALF_DAY_MINUTES;
  if (hour === 12) {
    return { day: targetDay, minutes: HALF_DAY_MINUTES + minute };
  }
  if (partOfDay === "AFTERNOON" || partOfDay === "EVENING" || partOfDay === "NIGHT") {
    return { day: targetDay, minutes: evening };
  }
  if (partOfDay === "DAWN" || partOfDay === "MORNING") {
    return { day: targetDay, minutes: morning };
  }
  // 날짜를 말하지 않았으면 오늘 남은 시각 중 가장 이른 것, 둘 다 지났으면 내일의 일반적 시각이다.
  if (targetDay.equals(today)) {
    if (morning > nowMinutes) {
      return { day: today, minutes: morning };
    }
    if (evening > nowMinutes) {
      return { day: today, minutes: evening };
    }
    return { day: today.add({ days: 1 }), minutes: conventionalMinutes(hour, minute) };
  }
  return { day: targetDay, minutes: conventionalMinutes(hour, minute) };
}

/** 날짜를 명시한 경우: 1~6시는 오후, 7~11시는 오전으로 본다. */
function conventionalMinutes(hour: number, minute: number): number {
  return (hour <= 6 ? hour + 12 : hour) * 60 + minute;
}
