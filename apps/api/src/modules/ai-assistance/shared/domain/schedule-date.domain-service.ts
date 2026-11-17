import { DAYS_OF_WEEK, type DayOfWeek } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import type { DateRef, ScheduleWarning } from "./todo-draft.constants.js";

/** "이번 달 초"로 보는 마지막 날(초순) */
const MONTH_EARLY_LAST_DAY = 10;
/** "올해 초"로 보는 달(1월) */
const YEAR_EARLY_MONTH = 1;
/** YYYY-MM-DD로 쓸 수 있는 마지막 해 */
const MAX_CALENDAR_YEAR = 9999;

/** 사용자 시간대의 달력 날짜. 시간대가 없어 DST와 무관하게 날짜만 계산한다. */
export type CalendarDay = Temporal.PlainDate;

export interface DayResolution {
  readonly day: CalendarDay;
  readonly warning?: ScheduleWarning;
}

export function isBefore(day: CalendarDay, other: CalendarDay): boolean {
  return Temporal.PlainDate.compare(day, other) < 0;
}

export function isAfter(day: CalendarDay, other: CalendarDay): boolean {
  return Temporal.PlainDate.compare(day, other) > 0;
}

export function formatDay(day: CalendarDay): string {
  return day.toString();
}

export function isoIndex(day: DayOfWeek): number {
  return DAYS_OF_WEEK.indexOf(day);
}

// 모델이 낸 숫자에는 범위 제한이 없다. Temporal 달력 범위(RangeError)나 네 자리 연도를 넘는 날짜는 읽지 못한 날짜다
export function representableDay<T extends { readonly day: CalendarDay }>(
  resolve: () => T,
): T | null {
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

export function resolveDateRef(ref: DateRef, today: CalendarDay): DayResolution {
  const stated = representableDay(() => resolveStatedDay(ref, today));
  return stated == null ? { day: today, warning: "INVALID_DATE" } : clampPastToToday(stated, today);
}

/** "금요일부터 일요일까지"의 끝 요일은 오늘이 아니라 시작일에서 가장 가까운 그 요일이다. */
export function resolveEndDateRef(
  ref: DateRef,
  today: CalendarDay,
  start: CalendarDay,
): DayResolution {
  const end = resolveDateRef(ref, today);
  return ref.kind === "WEEKDAY" && ref.weekday != null && isBefore(end.day, start)
    ? { day: findUpcomingWeekday(ref.weekday, start) }
    : end;
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
