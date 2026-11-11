import { DAY_OF_WEEK_ORDER, type DayOfWeek, TODO_REPEAT_MONTH_DAY_MAX } from "@aido/api/vocabulary";
import { range, uniq } from "es-toolkit";
import { match } from "ts-pattern";

import { instantFromDate } from "#api/shared/domain/time/instant";

import type {
  DateRef,
  PartOfDay,
  PlanRepeatRef,
  RepeatPattern,
  RepeatRef,
  ResolvedSchedule,
  ScheduleDraft,
  ScheduleWarning,
  TimeRef,
  TodoRepeatEndRule,
  TodoRepeatRule,
} from "./todo-draft.constants.js";

export interface ScheduleClock {
  readonly now: Date;
  readonly timeZone: string;
}

/** 반복 종료를 말하지 않은 반복 일정의 기본 기간 */
const DEFAULT_RECURRENCE_WEEKS = 4;
const HALF_DAY_MINUTES = 12 * 60;
/** "이번 달 초"로 보는 마지막 날(초순) */
const MONTH_EARLY_LAST_DAY = 10;
/** "올해 초"로 보는 달(1월) */
const YEAR_EARLY_MONTH = 1;
/** YYYY-MM-DD로 쓸 수 있는 마지막 해 */
const MAX_CALENDAR_YEAR = 9999;

/** 때만 말한 경우의 기본 시각(분). 자정은 대상 날짜 다음 날 00:00으로 따로 다룬다. */
const PART_OF_DAY_MINUTES: Readonly<Record<Exclude<PartOfDay, "MIDNIGHT">, number>> = {
  DAWN: 6 * 60,
  MORNING: 9 * 60,
  NOON: 12 * 60,
  AFTERNOON: 15 * 60,
  EVENING: 19 * 60,
  NIGHT: 21 * 60,
};

/** 요일 + 종료일 recurrence로 나타낼 수 없는 반복 */
const UNREPRESENTABLE_REPEAT_PATTERNS: ReadonlySet<RepeatPattern> = new Set([
  "UNSUPPORTED",
  "BIWEEKLY_DAYS",
  "MONTHLY_DAY",
]);

const WEEKDAYS: readonly DayOfWeek[] = ["MON", "TUE", "WED", "THU", "FRI"];
const WEEKEND: readonly DayOfWeek[] = ["SAT", "SUN"];

/** 사용자 시간대의 달력 날짜. 시간대가 없어 DST와 무관하게 날짜만 계산한다. */
type CalendarDay = Temporal.PlainDate;

function isBefore(day: CalendarDay, other: CalendarDay): boolean {
  return Temporal.PlainDate.compare(day, other) < 0;
}

function isAfter(day: CalendarDay, other: CalendarDay): boolean {
  return Temporal.PlainDate.compare(day, other) > 0;
}

// 모델이 낸 숫자에는 범위 제한이 없다. Temporal 달력 범위(RangeError)나 네 자리 연도를 넘는 날짜는 읽지 못한 날짜다
function representableDay<T extends { readonly day: CalendarDay }>(resolve: () => T): T | null {
  try {
    const resolved = resolve();
    return resolved.day.year > MAX_CALENDAR_YEAR ? null : resolved;
  } catch (error) {
    if (error instanceof RangeError) {
      return null;
    }
    throw error;
  }
}

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
export function resolveTodoSchedule(
  draft: ScheduleDraft<RepeatRef | PlanRepeatRef>,
  clock: ScheduleClock,
): ResolvedSchedule {
  const local = instantFromDate(clock.now).toZonedDateTimeISO(clock.timeZone);
  const today = local.toPlainDate();
  const nowMinutes = local.hour * 60 + local.minute;
  const warnings: ScheduleWarning[] = [];

  const dateExplicit = draft.date.kind !== "NONE";
  const resolvedDate = resolveDateRef(draft.date, today);
  if (resolvedDate.warning != null) {
    warnings.push(resolvedDate.warning);
  }

  const recurrenceBase = resolveRecurrenceWindow(draft.repeat, today, resolvedDate.day);
  const isRecurringDraft = recurrenceBase != null;

  let startDay = recurrenceBase?.start ?? resolvedDate.day;
  let scheduledMinutes: number | null = null;

  const isRelative = draft.time != null && isRelativeTime(draft.time, draft.date);
  const time =
    draft.time == null
      ? null
      : resolveTime(draft.time, isRelative, startDay, nowMinutes, today, clock);
  if (time === "INVALID") {
    warnings.push("INVALID_TIME");
  } else if (time != null) {
    scheduledMinutes = time.minutes;
    // 반복 일정의 시작일은 시각과 무관하게 반복 규칙이 정한다.
    if (!isRecurringDraft) {
      const passedToday = !isRelative && time.day.equals(today) && time.minutes <= nowMinutes;
      if (passedToday && !dateExplicit) {
        // 날짜를 말하지 않은 단발 일정의 시각이 이미 지났으면 내일로 넘긴다.
        startDay = today.add({ days: 1 });
      } else if (passedToday && draft.time?.hour == null) {
        // "오늘 아침"처럼 오늘을 말했는데 그 때가 지났으면 날짜는 지키고 지난 기본 시각을 만들지 않는다.
        startDay = today;
        scheduledMinutes = null;
      } else {
        startDay = time.day;
      }
    }
  }

  let endDate: string | null = null;
  if (draft.endDate != null && draft.endDate.kind !== "NONE") {
    const end = resolveEndDateRef(draft.endDate, today, startDay);
    if (end.warning != null) {
      warnings.push(end.warning);
    }
    if (isBefore(end.day, startDay)) {
      warnings.push("END_BEFORE_START");
    } else if (isAfter(end.day, startDay)) {
      endDate = formatDay(end.day);
    }
  }

  let recurrence: ResolvedSchedule["recurrence"] = null;
  if (UNREPRESENTABLE_REPEAT_PATTERNS.has(draft.repeat.pattern)) {
    warnings.push("UNSUPPORTED_RECURRENCE");
  }
  if (recurrenceBase != null) {
    if (recurrenceBase.days.length === 0) {
      warnings.push("EMPTY_RECURRENCE");
    } else {
      const end = recurrenceBase.end ?? resolveRecurrenceEnd(draft.repeat, startDay, today);
      recurrence = {
        daysOfWeek: [...recurrenceBase.days],
        endDate: formatDay(isBefore(end, startDay) ? startDay : end),
      };
    }
  }

  const repeat = resolveRepeat(draft.repeat, recurrenceBase, startDay, today);
  if (
    repeat != null &&
    recurrenceBase?.end == null &&
    hasSpokenRepeatEnd(draft.repeat) &&
    resolveSpokenRepeatEnd(draft.repeat, startDay, today) == null
  ) {
    warnings.push("REPEAT_END_NOT_AFTER_START");
  }

  const scheduledTime = scheduledMinutes == null ? null : formatMinutes(scheduledMinutes);
  return {
    startDate: formatDay(startDay),
    endDate,
    scheduledTime,
    isAllDay: scheduledTime == null,
    isRecurring: recurrence != null,
    recurrence,
    repeat,
    warnings,
  };
}

const ONCE_ON_WEEKEND_PATTERNS: ReadonlySet<RepeatPattern> = new Set([
  "THIS_WEEKEND",
  "NEXT_WEEKEND",
]);

/**
 * 계획(빠른 계획·녹음 정리)의 일정. "주말에 장보기", "this weekend"는 그 주말 토요일 한 번이고
 * (일요일에 말한 이번 주말은 오늘) 되풀이는 "주말마다"(`WEEKENDS`)일 때만이다.
 * 출시 parse 응답의 `recurrence`는 요일 + 종료일 그대로라 `resolveTodoSchedule`을 바꾸지 않는다.
 */
export function resolvePlanSchedule(
  draft: ScheduleDraft<PlanRepeatRef>,
  clock: ScheduleClock,
): ResolvedSchedule {
  const schedule = resolveTodoSchedule(draft, clock);
  return ONCE_ON_WEEKEND_PATTERNS.has(draft.repeat.pattern)
    ? { ...schedule, isRecurring: false, recurrence: null, repeat: null }
    : schedule;
}

/**
 * 출시 parse 응답은 "이번 주말 X"를 토·일 + 그 주 일요일까지로 준다. 새 반복 규칙(repeat)에서는 끝이 시작 다음 날까지인
 * 주말 반복을 반복이 아니라 시작일 한 번으로 본다. 앱 `TodoRepeatPolicy.isSingleWeekendRepeat`와 같은 판단이다.
 */
export function isSingleWeekendRepeat(repeat: TodoRepeatRule, startDate: string): boolean {
  return (
    repeat.frequency === "WEEKLY" &&
    repeat.weekdays.includes("SAT") &&
    repeat.weekdays.includes("SUN") &&
    repeat.end.type === "UNTIL" &&
    Temporal.PlainDate.from(startDate).until(Temporal.PlainDate.from(repeat.end.date)).days <= 1
  );
}

function resolveRepeat(
  repeat: RepeatRef | PlanRepeatRef,
  window: RecurrenceWindow | null,
  start: CalendarDay,
  today: CalendarDay,
): TodoRepeatRule | null {
  const end = resolveRepeatEnd(repeat, window, start, today);
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

function readMonthDay(repeat: RepeatRef | PlanRepeatRef, start: CalendarDay): number {
  const monthDay = "monthDay" in repeat ? repeat.monthDay : null;
  return monthDay != null && 1 <= monthDay && monthDay <= TODO_REPEAT_MONTH_DAY_MAX
    ? monthDay
    : start.day;
}

function resolveRepeatEnd(
  repeat: RepeatRef,
  window: RecurrenceWindow | null,
  start: CalendarDay,
  today: CalendarDay,
): TodoRepeatEndRule {
  const end = window?.end ?? resolveSpokenRepeatEnd(repeat, start, today);
  if (end == null) {
    return { type: "NEVER" };
  }
  return { type: "UNTIL", date: formatDay(isBefore(end, start) ? start : end) };
}

function resolveDateRef(ref: DateRef, today: CalendarDay): DayResolution {
  const stated = representableDay(() => resolveStatedDay(ref, today));
  return stated == null ? { day: today, warning: "INVALID_DATE" } : clampPastToToday(stated, today);
}

/** 여기까지 온 지난 값은 음수나 지난 날을 집어 말한 값이라 다음 시기로 넘기면 말한 시기와 달라진다. */
function clampPastToToday(stated: DayResolution, today: CalendarDay): DayResolution {
  return isBefore(stated.day, today) ? { day: today, warning: "INVALID_DATE" } : stated;
}

/** "이번 달 초"가 지났으면 할 일로 쓸 수 있는 다음 달 초로 넘긴다. */
function findUpcomingMonthStart(today: CalendarDay): CalendarDay {
  return today.day <= MONTH_EARLY_LAST_DAY ? today : today.with({ day: 1 }).add({ months: 1 });
}

/** "올해 초"가 지났으면 할 일로 쓸 수 있는 내년 초로 넘긴다. */
function findUpcomingYearStart(today: CalendarDay): CalendarDay {
  return today.month === YEAR_EARLY_MONTH ? today : yearStart(today.year + 1);
}

function yearStart(year: number): CalendarDay {
  return Temporal.PlainDate.from({ year, month: 1, day: 1 });
}

function monthEnd(day: CalendarDay): CalendarDay {
  return day.with({ day: day.daysInMonth });
}

function resolveStatedDay(ref: DateRef, today: CalendarDay): DayResolution {
  const amount = ref.amount ?? 0;
  return (
    match(ref.kind)
      .with("NONE", "TODAY", () => ({ day: today }))
      .with("OFFSET_DAYS", () => ({ day: today.add({ days: amount }) }))
      .with("OFFSET_WEEKS", () => ({ day: today.add({ days: amount * 7 }) }))
      // 없는 말일은 그 달의 마지막 날로 맞춘다 (1월 31일 + 1개월 → 2월 말일, overflow "constrain").
      .with("OFFSET_MONTHS", () => ({ day: today.add({ months: amount }) }))
      .with("WEEKDAY", () => resolveWeekday(ref, today))
      .with("CALENDAR_DATE", () => resolveCalendarDate(ref, today))
      .with("MONTH_START", () => ({
        day:
          amount === 0
            ? findUpcomingMonthStart(today)
            : today.with({ day: 1 }).add({ months: amount }),
      }))
      .with("MONTH_END", () => ({ day: monthEnd(today.with({ day: 1 }).add({ months: amount })) }))
      .with("YEAR_START", () => ({
        day: amount === 0 ? findUpcomingYearStart(today) : yearStart(today.year + amount),
      }))
      .with("YEAR_END", () => ({
        day: Temporal.PlainDate.from({ year: today.year + amount, month: 12, day: 31 }),
      }))
      .exhaustive()
  );
}

/** "금요일부터 일요일까지"의 끝 요일은 오늘이 아니라 시작일에서 가장 가까운 그 요일이다. */
function resolveEndDateRef(ref: DateRef, today: CalendarDay, start: CalendarDay): DayResolution {
  const end = resolveDateRef(ref, today);
  return ref.kind === "WEEKDAY" && ref.weekday != null && isBefore(end.day, start)
    ? { day: findUpcomingWeekday(ref.weekday, start) }
    : end;
}

function isoIndex(day: DayOfWeek): number {
  return DAY_OF_WEEK_ORDER.indexOf(day);
}

function getWeekdayThisWeek(weekday: DayOfWeek, baseDay: CalendarDay): CalendarDay {
  return baseDay.add({ days: isoIndex(weekday) + 1 - baseDay.dayOfWeek });
}

/** 기준일을 포함해 가장 가까운 그 요일 */
function findUpcomingWeekday(weekday: DayOfWeek, baseDay: CalendarDay): CalendarDay {
  const weekdayThisWeek = getWeekdayThisWeek(weekday, baseDay);
  return isBefore(weekdayThisWeek, baseDay) ? weekdayThisWeek.add({ weeks: 1 }) : weekdayThisWeek;
}

function resolveWeekday(ref: DateRef, today: CalendarDay): DayResolution {
  if (ref.weekday == null) {
    return { day: today, warning: "INVALID_DATE" };
  }
  const upcomingWeekday = findUpcomingWeekday(ref.weekday, today);
  if (ref.weekOffset == null) {
    return { day: upcomingWeekday };
  }
  const statedWeekday = getWeekdayThisWeek(ref.weekday, today).add({ weeks: ref.weekOffset });
  // 할 일에 지난 날짜는 쓸 수 없어 다음 그 요일로 넘긴다.
  return { day: isBefore(statedWeekday, today) ? upcomingWeekday : statedWeekday };
}

function calendarDay(year: number, month: number, day: number): CalendarDay | null {
  try {
    return Temporal.PlainDate.from({ year, month, day }, { overflow: "reject" });
  } catch (error) {
    if (error instanceof RangeError) {
      return null;
    }
    throw error;
  }
}

function resolveCalendarDate(ref: DateRef, today: CalendarDay): DayResolution {
  const { day, month, year } = ref;
  if (day == null) {
    return { day: today, warning: "INVALID_DATE" };
  }
  if (year != null && month != null) {
    const exact = calendarDay(year, month, day);
    return exact == null ? { day: today, warning: "INVALID_DATE" } : { day: exact };
  }
  // 연도·월을 생략하면 아직 지나지 않은 가장 가까운 날짜를 고른다.
  const candidates =
    month == null
      ? [0, 1, 2].map((offset) => {
          const base = today.add({ months: offset });
          return calendarDay(base.year, base.month, day);
        })
      : [0, 1, 2, 3, 4].map((offset) => calendarDay(today.year + offset, month, day));
  const next = candidates.find(
    (candidate): candidate is CalendarDay => candidate != null && !isBefore(candidate, today),
  );
  return next == null ? { day: today, warning: "INVALID_DATE" } : { day: next };
}

/**
 * "N분 뒤"는 지금부터의 경과 시간이라 1분 이상이고 날짜를 말하지 않았거나 오늘일 때만 쓴다.
 * 0·음수, 또는 "내일"처럼 다른 날을 말한 표현과 함께 온 값은 무시하고 날짜·때를 따른다.
 */
function isRelativeTime(ref: TimeRef, date: DateRef): boolean {
  return (
    ref.relativeMinutes != null &&
    ref.relativeMinutes > 0 &&
    (date.kind === "NONE" || date.kind === "TODAY")
  );
}

function resolveTime(
  ref: TimeRef,
  isRelative: boolean,
  targetDay: CalendarDay,
  nowMinutes: number,
  today: CalendarDay,
  clock: ScheduleClock,
): TimeResolution | "INVALID" | null {
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
  return resolveAmbiguousHour(hour, minute, ref.partOfDay, targetDay, nowMinutes, today);
}

/** 오전/오후 단서가 없는 1~12시. */
function resolveAmbiguousHour(
  hour: number,
  minute: number,
  partOfDay: PartOfDay | null,
  targetDay: CalendarDay,
  nowMinutes: number,
  today: CalendarDay,
): TimeResolution {
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

interface RecurrenceWindow {
  readonly start: CalendarDay;
  readonly end: CalendarDay | null;
  readonly days: readonly DayOfWeek[];
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

function resolveRecurrenceWindow(
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

function hasSpokenRepeatEnd(repeat: RepeatRef): boolean {
  return (
    (repeat.until != null && repeat.until.kind !== "NONE") ||
    (repeat.forDuration != null && repeat.forDuration.amount > 0)
  );
}

/** 말한 반복의 끝. 시작일보다 뒤가 아니면 반복이 되지 않으므로 말하지 않은 것으로 본다(모델이 지어낸 경우가 있다). */
function resolveSpokenRepeatEnd(
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

function resolveDurationEnd({ forDuration }: RepeatRef, start: CalendarDay): CalendarDay {
  const amount = forDuration?.amount ?? 0;
  const end = match(forDuration?.unit ?? "DAY")
    .with("DAY", () => start.add({ days: amount }))
    .with("WEEK", () => start.add({ weeks: amount }))
    .with("MONTH", () => start.add({ months: amount }))
    .exhaustive();
  return end.subtract({ days: 1 });
}

function resolveRecurrenceEnd(
  repeat: RepeatRef,
  start: CalendarDay,
  today: CalendarDay,
): CalendarDay {
  return (
    resolveSpokenRepeatEnd(repeat, start, today) ?? today.add({ weeks: DEFAULT_RECURRENCE_WEEKS })
  );
}

function formatDay(day: CalendarDay): string {
  return day.toString();
}

function formatMinutes(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  return `${String(hour).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
