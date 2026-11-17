import { DAY_OF_WEEK_ORDER, type DayOfWeek, TODO_REPEAT_MONTH_DAY_MAX } from "@aido/api/vocabulary";
import { range, uniq } from "es-toolkit";
import { match } from "ts-pattern";

import {
  type CalendarDay,
  formatDay,
  isAfter,
  isBefore,
  isoIndex,
  representableDay,
  resolveDateRef,
} from "./schedule-date.domain-service.js";
import type {
  PlanRepeatRef,
  RepeatRef,
  TodoRepeatEndRule,
  TodoRepeatRule,
} from "./todo-draft.constants.js";

/** 반복 종료를 말하지 않은 반복 일정의 기본 기간 */
const DEFAULT_RECURRENCE_WEEKS = 4;

const WEEKDAYS: readonly DayOfWeek[] = ["MON", "TUE", "WED", "THU", "FRI"];
const WEEKEND: readonly DayOfWeek[] = ["SAT", "SUN"];

/** 요일 + 종료일 recurrence로 나타내는 반복 구간. end가 null이면 말한 끝이나 기본 기간을 쓴다 */
export interface RecurrenceWindow {
  readonly start: CalendarDay;
  readonly end: CalendarDay | null;
  readonly days: readonly DayOfWeek[];
}

/** 반복 규칙을 정하는 기준. window는 요일 반복의 구간이고 start는 정한 시작일이다 */
export interface RepeatBasis {
  readonly window: RecurrenceWindow | null;
  readonly start: CalendarDay;
  readonly today: CalendarDay;
}

export function resolveRecurrenceWindow(
  repeat: RepeatRef,
  today: CalendarDay,
  resolvedDay: CalendarDay,
): RecurrenceWindow | null {
  const monday = today.subtract({ days: today.dayOfWeek - 1 });
  const sunday = monday.add({ days: 6 });
  const everyDay = [...DAY_OF_WEEK_ORDER];
  return match(repeat.pattern)
    .with("NONE", "UNSUPPORTED", "BIWEEKLY_DAYS", "MONTHLY_DAY", () => null)
    .with("WEEKLY_DAYS", () => ({
      start: resolvedDay,
      end: null,
      days: sortDays(repeat.daysOfWeek ?? []),
    }))
    .with("DAILY", () => ({ start: resolvedDay, end: null, days: everyDay }))
    .with("WEEKDAYS", () => ({ start: resolvedDay, end: null, days: [...WEEKDAYS] }))
    .with("WEEKENDS", () => ({ start: resolvedDay, end: null, days: [...WEEKEND] }))
    .with("THIS_WEEK", () => ({ start: today, end: sunday, days: daysBetween(today, sunday) }))
    .with("NEXT_WEEK", () => ({
      start: monday.add({ days: 7 }),
      end: sunday.add({ days: 7 }),
      days: everyDay,
    }))
    .with("WEEK_AFTER_NEXT", () => ({
      start: monday.add({ days: 14 }),
      end: sunday.add({ days: 14 }),
      days: everyDay,
    }))
    .with("THIS_WEEKEND", () => {
      const saturday = monday.add({ days: 5 });
      return {
        start: isAfter(today, saturday) ? today : saturday,
        end: sunday,
        days: [...WEEKEND],
      };
    })
    .with("NEXT_WEEKEND", () => ({
      start: monday.add({ days: 12 }),
      end: sunday.add({ days: 7 }),
      days: [...WEEKEND],
    }))
    .with("THIS_WEEKDAYS", () => {
      const friday = monday.add({ days: 4 });
      // 주말에 말한 "이번 주 주중"은 남은 평일이 없으므로 다음 주 평일로 본다.
      if (isAfter(today, friday)) {
        return {
          start: monday.add({ days: 7 }),
          end: friday.add({ days: 7 }),
          days: [...WEEKDAYS],
        };
      }
      return { start: today, end: friday, days: daysBetween(today, friday) };
    })
    .exhaustive();
}

export function resolveRepeat(
  repeat: RepeatRef | PlanRepeatRef,
  basis: RepeatBasis,
): TodoRepeatRule | null {
  const { window, start } = basis;
  const end = resolveRepeatEnd(repeat, basis);
  return match(repeat.pattern)
    .returnType<TodoRepeatRule | null>()
    .with("NONE", "UNSUPPORTED", () => null)
    .with("DAILY", () => ({ frequency: "DAILY", end }))
    .with("MONTHLY_DAY", () => ({
      frequency: "MONTHLY",
      monthDay: readMonthDay(repeat, start),
      end,
    }))
    .with("BIWEEKLY_DAYS", () => {
      const days = sortDays(repeat.daysOfWeek ?? []);
      return days.length === 0 ? null : { frequency: "WEEKLY", interval: 2, weekdays: days, end };
    })
    .with(
      "WEEKLY_DAYS",
      "WEEKDAYS",
      "WEEKENDS",
      "THIS_WEEK",
      "NEXT_WEEK",
      "WEEK_AFTER_NEXT",
      "THIS_WEEKEND",
      "NEXT_WEEKEND",
      "THIS_WEEKDAYS",
      () => {
        const days = sortDays(window?.days ?? []);
        return days.length === 0 ? null : { frequency: "WEEKLY", interval: 1, weekdays: days, end };
      },
    )
    .exhaustive();
}

export function hasSpokenRepeatEnd(repeat: RepeatRef): boolean {
  return (
    (repeat.until != null && repeat.until.kind !== "NONE") ||
    (repeat.forDuration != null && repeat.forDuration.amount > 0)
  );
}

/** 말한 반복의 끝. 시작일보다 뒤가 아니면 반복이 되지 않으므로 말하지 않은 것으로 본다(모델이 지어낸 경우가 있다). */
export function resolveSpokenRepeatEnd(
  repeat: RepeatRef,
  start: CalendarDay,
  today: CalendarDay,
): CalendarDay | null {
  if (!hasSpokenRepeatEnd(repeat)) {
    return null;
  }
  const end =
    repeat.until != null && repeat.until.kind !== "NONE"
      ? resolveDateRef(repeat.until, today).day
      : representableDay(() => ({ day: resolveDurationEnd(repeat, start) }))?.day;
  return end != null && isAfter(end, start) ? end : null;
}

export function resolveRecurrenceEnd(
  repeat: RepeatRef,
  start: CalendarDay,
  today: CalendarDay,
): CalendarDay {
  return (
    resolveSpokenRepeatEnd(repeat, start, today) ?? today.add({ weeks: DEFAULT_RECURRENCE_WEEKS })
  );
}

function readMonthDay(repeat: RepeatRef | PlanRepeatRef, start: CalendarDay): number {
  const monthDay = "monthDay" in repeat ? repeat.monthDay : null;
  return monthDay != null && 1 <= monthDay && monthDay <= TODO_REPEAT_MONTH_DAY_MAX
    ? monthDay
    : start.day;
}

function resolveRepeatEnd(repeat: RepeatRef, basis: RepeatBasis): TodoRepeatEndRule {
  const { window, start, today } = basis;
  const end = window?.end ?? resolveSpokenRepeatEnd(repeat, start, today);
  if (end == null) {
    return { type: "NEVER" };
  }
  return { type: "UNTIL", date: formatDay(isBefore(end, start) ? start : end) };
}

function daysBetween(from: CalendarDay, to: CalendarDay): DayOfWeek[] {
  const count = from.until(to).days;
  return range(count + 1).map((offset) => {
    const isoDay = from.add({ days: offset }).dayOfWeek;
    return DAY_OF_WEEK_ORDER[isoDay - 1] ?? "MON";
  });
}

function sortDays(days: readonly DayOfWeek[]): DayOfWeek[] {
  return uniq(days).sort((left, right) => isoIndex(left) - isoIndex(right));
}

function resolveDurationEnd({ forDuration }: RepeatRef, start: CalendarDay): CalendarDay {
  const amount = forDuration?.amount ?? 0;
  const end = match(forDuration?.unit ?? "DAY")
    .with("DAY", () => start.add({ days: amount }))
    .with("WEEK", () => start.add({ weeks: amount }))
    .with("MONTH", () => start.add({ months: amount }))
    .exhaustive();
  return end.subtract({ days: 1 });
}
