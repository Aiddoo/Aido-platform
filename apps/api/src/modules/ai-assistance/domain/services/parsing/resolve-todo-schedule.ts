import { DAY_OF_WEEK_ORDER, type DayOfWeek } from "@aido/api/vocabulary";
import dayjs from "dayjs";
import { uniq } from "es-toolkit";
import { match } from "ts-pattern";

import type {
  DateRef,
  PartOfDay,
  RepeatRef,
  ResolvedSchedule,
  ScheduleDraft,
  ScheduleWarning,
  TimeRef,
} from "../../types/parsing/todo-draft.types.js";

export interface ScheduleClock {
  readonly now: Date;
  readonly timeZone: string;
}

/** 반복 종료를 말하지 않은 반복 일정의 기본 기간 */
const DEFAULT_RECURRENCE_WEEKS = 4;
const MINUTES_PER_DAY = 24 * 60;
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

const WEEKDAYS: readonly DayOfWeek[] = ["MON", "TUE", "WED", "THU", "FRI"];
const WEEKEND: readonly DayOfWeek[] = ["SAT", "SUN"];

/** 사용자 시간대의 달력 날짜를 UTC 자정으로 고정해 DST와 무관하게 날짜만 계산한다. */
type CalendarDay = dayjs.Dayjs;

interface DayResolution {
  readonly day: CalendarDay;
  readonly warning?: ScheduleWarning;
}

interface TimeResolution {
  readonly day: CalendarDay;
  readonly minutes: number;
}

/**
 * LLM이 읽은 일정 표현을 사용자 시간대 기준 날짜·시각·반복으로 결정적으로 바꾼다.
 * 같은 draft·now·timeZone이면 항상 같은 결과를 낸다.
 */
export function resolveTodoSchedule(draft: ScheduleDraft, clock: ScheduleClock): ResolvedSchedule {
  const local = dayjs(clock.now).tz(clock.timeZone);
  const today = dayjs.utc(local.format("YYYY-MM-DD"));
  const nowMinutes = local.hour() * 60 + local.minute();
  const warnings: ScheduleWarning[] = [];

  const dateExplicit = draft.date.kind !== "NONE";
  const resolvedDate = resolveDateRef(draft.date, today);
  if (resolvedDate.warning !== undefined) warnings.push(resolvedDate.warning);

  const recurrenceBase = resolveRecurrenceWindow(draft.repeat, today, resolvedDate.day);
  const isRecurringDraft = recurrenceBase !== null;

  let startDay = recurrenceBase?.start ?? resolvedDate.day;
  let scheduledMinutes: number | null = null;

  const time = draft.time === null ? null : resolveTime(draft.time, startDay, nowMinutes, today);
  if (time === "INVALID") {
    warnings.push("INVALID_TIME");
  } else if (time !== null) {
    scheduledMinutes = time.minutes;
    // 반복 일정의 시작일은 시각과 무관하게 반복 규칙이 정한다.
    if (!isRecurringDraft) {
      const isRelative = draft.time?.relativeMinutes !== undefined;
      // 날짜를 말하지 않은 단발 일정의 시각이 이미 지났으면 내일로 넘긴다.
      const passedToday =
        !isRelative && !dateExplicit && time.day.isSame(today) && time.minutes <= nowMinutes;
      startDay = passedToday ? today.add(1, "day") : time.day;
    }
  }

  let endDate: string | null = null;
  if (draft.endDate !== undefined && draft.endDate.kind !== "NONE") {
    const end = resolveDateRef(draft.endDate, today);
    if (end.warning !== undefined) warnings.push(end.warning);
    if (end.day.isBefore(startDay)) warnings.push("END_BEFORE_START");
    else if (end.day.isAfter(startDay)) endDate = formatDay(end.day);
  }

  let recurrence: ResolvedSchedule["recurrence"] = null;
  if (draft.repeat.pattern === "UNSUPPORTED") warnings.push("UNSUPPORTED_RECURRENCE");
  if (recurrenceBase !== null) {
    if (recurrenceBase.days.length === 0) {
      warnings.push("EMPTY_RECURRENCE");
    } else {
      const end = recurrenceBase.end ?? resolveRecurrenceEnd(draft.repeat, startDay, today);
      recurrence = {
        daysOfWeek: [...recurrenceBase.days],
        endDate: formatDay(end.isBefore(startDay) ? startDay : end),
      };
    }
  }

  const scheduledTime = scheduledMinutes === null ? null : formatMinutes(scheduledMinutes);
  return {
    startDate: formatDay(startDay),
    endDate,
    scheduledTime,
    isAllDay: scheduledTime === null,
    isRecurring: recurrence !== null,
    recurrence,
    warnings,
  };
}

function resolveDateRef(ref: DateRef, today: CalendarDay): DayResolution {
  const amount = ref.amount ?? 0;
  return (
    match(ref.kind)
      .with("NONE", "TODAY", () => ({ day: today }))
      .with("OFFSET_DAYS", () => ({ day: today.add(amount, "day") }))
      .with("OFFSET_WEEKS", () => ({ day: today.add(amount * 7, "day") }))
      // dayjs는 없는 말일을 그 달의 마지막 날로 맞춘다 (1월 31일 + 1개월 → 2월 말일).
      .with("OFFSET_MONTHS", () => ({ day: today.add(amount, "month") }))
      .with("WEEKDAY", () => resolveWeekday(ref, today))
      .with("CALENDAR_DATE", () => resolveCalendarDate(ref, today))
      .with("MONTH_START", () => ({ day: today.add(amount, "month").startOf("month") }))
      .with("MONTH_END", () => ({ day: today.add(amount, "month").endOf("month").startOf("day") }))
      .with("YEAR_START", () => ({ day: dayjs.utc(`${today.year() + amount}-01-01`) }))
      .with("YEAR_END", () => ({ day: dayjs.utc(`${today.year() + amount}-12-31`) }))
      .exhaustive()
  );
}

function isoIndex(day: DayOfWeek): number {
  return DAY_OF_WEEK_ORDER.indexOf(day);
}

function resolveWeekday(ref: DateRef, today: CalendarDay): DayResolution {
  if (ref.weekday === undefined) return { day: today, warning: "INVALID_DATE" };
  const target = isoIndex(ref.weekday);
  if (ref.weekOffset === undefined) {
    // 요일만 말하면 오늘을 포함해 가장 가까운 그 요일이다.
    const diff = (target - (today.isoWeekday() - 1) + 7) % 7;
    return { day: today.add(diff, "day") };
  }
  return { day: today.startOf("isoWeek").add(ref.weekOffset * 7 + target, "day") };
}

function calendarDay(year: number, month: number, day: number): CalendarDay | null {
  const candidate = dayjs.utc(Date.UTC(year, month - 1, day));
  return candidate.year() === year && candidate.month() === month - 1 && candidate.date() === day
    ? candidate
    : null;
}

function resolveCalendarDate(ref: DateRef, today: CalendarDay): DayResolution {
  const { day, month, year } = ref;
  if (day === undefined) return { day: today, warning: "INVALID_DATE" };
  if (year !== undefined && month !== undefined) {
    const exact = calendarDay(year, month, day);
    return exact === null ? { day: today, warning: "INVALID_DATE" } : { day: exact };
  }
  // 연도·월을 생략하면 아직 지나지 않은 가장 가까운 날짜를 고른다.
  const candidates =
    month === undefined
      ? [0, 1, 2].map((offset) => {
          const base = today.add(offset, "month");
          return calendarDay(base.year(), base.month() + 1, day);
        })
      : [0, 1, 2, 3, 4].map((offset) => calendarDay(today.year() + offset, month, day));
  const next = candidates.find(
    (candidate): candidate is CalendarDay => candidate !== null && !candidate.isBefore(today),
  );
  return next === undefined ? { day: today, warning: "INVALID_DATE" } : { day: next };
}

function resolveTime(
  ref: TimeRef,
  targetDay: CalendarDay,
  nowMinutes: number,
  today: CalendarDay,
): TimeResolution | "INVALID" | null {
  if (ref.relativeMinutes !== undefined) {
    const total = nowMinutes + ref.relativeMinutes;
    const dayShift = Math.floor(total / MINUTES_PER_DAY);
    return { day: today.add(dayShift, "day"), minutes: total - dayShift * MINUTES_PER_DAY };
  }
  if (ref.hour === undefined) {
    if (ref.partOfDay === undefined) return null;
    if (ref.partOfDay === "MIDNIGHT") return { day: targetDay.add(1, "day"), minutes: 0 };
    return { day: targetDay, minutes: PART_OF_DAY_MINUTES[ref.partOfDay] };
  }
  const minute = ref.minute ?? 0;
  if (!Number.isInteger(ref.hour) || ref.hour < 0 || ref.hour > 23) return "INVALID";
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return "INVALID";
  const hour = ref.hour;

  if (ref.meridiem === "PM" && hour < 12)
    return { day: targetDay, minutes: (hour + 12) * 60 + minute };
  if (ref.meridiem === "AM" && hour === 12) return { day: targetDay, minutes: minute };
  if (ref.meridiem === "AM" || ref.meridiem === "PM" || hour === 0 || hour > 12) {
    return { day: targetDay, minutes: hour * 60 + minute };
  }
  return resolveAmbiguousHour(hour, minute, ref.partOfDay, targetDay, nowMinutes, today);
}

/** 오전/오후 단서가 없는 1~12시. */
function resolveAmbiguousHour(
  hour: number,
  minute: number,
  partOfDay: PartOfDay | undefined,
  targetDay: CalendarDay,
  nowMinutes: number,
  today: CalendarDay,
): TimeResolution {
  const morning = (hour % 12) * 60 + minute;
  const evening = morning + HALF_DAY_MINUTES;
  if (hour === 12) return { day: targetDay, minutes: HALF_DAY_MINUTES + minute };
  if (partOfDay === "AFTERNOON" || partOfDay === "EVENING" || partOfDay === "NIGHT") {
    return { day: targetDay, minutes: evening };
  }
  if (partOfDay === "DAWN" || partOfDay === "MORNING") return { day: targetDay, minutes: morning };
  // 날짜를 말하지 않았으면 오늘 남은 시각 중 가장 이른 것, 둘 다 지났으면 내일의 일반적 시각이다.
  if (targetDay.isSame(today)) {
    if (morning > nowMinutes) return { day: today, minutes: morning };
    if (evening > nowMinutes) return { day: today, minutes: evening };
    return { day: today.add(1, "day"), minutes: conventionalMinutes(hour, minute) };
  }
  return { day: targetDay, minutes: conventionalMinutes(hour, minute) };
}

/** 날짜를 명시한 경우: 1~6시는 오후, 7~11시는 오전으로 본다. */
function conventionalMinutes(hour: number, minute: number): number {
  return (hour <= 6 ? hour + 12 : hour) * 60 + minute;
}

interface RecurrenceWindow {
  readonly start: CalendarDay;
  readonly end: CalendarDay | null;
  readonly days: readonly DayOfWeek[];
}

function daysBetween(from: CalendarDay, to: CalendarDay): DayOfWeek[] {
  const count = to.diff(from, "day");
  return Array.from({ length: count + 1 }, (_, offset) => {
    const isoDay = from.add(offset, "day").isoWeekday();
    return DAY_OF_WEEK_ORDER[isoDay - 1] ?? "MON";
  });
}

function sortDays(days: readonly DayOfWeek[]): DayOfWeek[] {
  return uniq(days).sort((left, right) => isoIndex(left) - isoIndex(right));
}

function resolveRecurrenceWindow(
  repeat: RepeatRef,
  today: CalendarDay,
  resolvedDay: CalendarDay,
): RecurrenceWindow | null {
  const monday = today.startOf("isoWeek");
  const sunday = monday.add(6, "day");
  const everyDay = [...DAY_OF_WEEK_ORDER];
  return match(repeat.pattern)
    .with("NONE", "UNSUPPORTED", () => null)
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
      start: monday.add(7, "day"),
      end: sunday.add(7, "day"),
      days: everyDay,
    }))
    .with("WEEK_AFTER_NEXT", () => ({
      start: monday.add(14, "day"),
      end: sunday.add(14, "day"),
      days: everyDay,
    }))
    .with("THIS_WEEKEND", () => {
      const saturday = monday.add(5, "day");
      return { start: today.isAfter(saturday) ? today : saturday, end: sunday, days: [...WEEKEND] };
    })
    .with("NEXT_WEEKEND", () => ({
      start: monday.add(12, "day"),
      end: sunday.add(7, "day"),
      days: [...WEEKEND],
    }))
    .with("THIS_WEEKDAYS", () => {
      const friday = monday.add(4, "day");
      // 주말에 말한 "이번 주 주중"은 남은 평일이 없으므로 다음 주 평일로 본다.
      if (today.isAfter(friday)) {
        return { start: monday.add(7, "day"), end: friday.add(7, "day"), days: [...WEEKDAYS] };
      }
      return { start: today, end: friday, days: daysBetween(today, friday) };
    })
    .exhaustive();
}

function resolveRecurrenceEnd(
  repeat: RepeatRef,
  start: CalendarDay,
  today: CalendarDay,
): CalendarDay {
  if (repeat.until !== undefined && repeat.until.kind !== "NONE") {
    return resolveDateRef(repeat.until, today).day;
  }
  if (repeat.forDuration !== undefined && repeat.forDuration.amount > 0) {
    const { unit, amount } = repeat.forDuration;
    const end = match(unit)
      .with("DAY", () => start.add(amount, "day"))
      .with("WEEK", () => start.add(amount, "week"))
      .with("MONTH", () => start.add(amount, "month"))
      .exhaustive();
    return end.subtract(1, "day");
  }
  return today.add(DEFAULT_RECURRENCE_WEEKS, "week");
}

function formatDay(day: CalendarDay): string {
  return day.format("YYYY-MM-DD");
}

function formatMinutes(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  return `${String(hour).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
