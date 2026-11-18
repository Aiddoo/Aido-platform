import {
  DAYS_OF_WEEK,
  TODO_REPEAT_INTERVALS,
  TODO_REPEAT_MONTH_DAY_MAX,
  TODO_REPEAT_OCCURRENCE_SEARCH_DAYS,
  TODO_SERIES_LIMITS,
  type DayOfWeek,
  type TodoRepeatFrequency,
  type TodoRepeatInterval,
} from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import { ValueObject } from "#api/shared/domain/model/value-object";

import { invalidRepeatRule } from "./todo-series.errors.js";

export type RepeatEnd =
  | { readonly type: "NEVER" }
  | { readonly type: "UNTIL"; readonly date: string }
  | { readonly type: "COUNT"; readonly count: number };

export type RepeatSpec =
  | { readonly frequency: "DAILY"; readonly end: RepeatEnd }
  | {
      readonly frequency: "WEEKLY";
      readonly interval: TodoRepeatInterval;
      readonly weekdays: readonly DayOfWeek[];
      readonly end: RepeatEnd;
    }
  | { readonly frequency: "MONTHLY"; readonly monthDay: number; readonly end: RepeatEnd };

export interface OccurrenceRange {
  readonly seriesStart: Temporal.PlainDate;
  readonly from: Temporal.PlainDate;
  readonly through: Temporal.PlainDate;
  /** 끝이 COUNT일 때 이미 만든 회차 수 */
  readonly generatedCount?: number;
}

export interface RepeatRuleProps {
  readonly frequency: TodoRepeatFrequency;
  readonly interval: TodoRepeatInterval;
  readonly weekdays: readonly DayOfWeek[] | null;
  readonly monthDay: number | null;
  readonly end: RepeatEnd;
}

const DAYS_PER_WEEK = 7;

function assertRule(condition: boolean, field: string): void {
  if (!condition) {
    throw invalidRepeatRule(field);
  }
}

function assertEnd(end: RepeatEnd): void {
  if (end.type === "COUNT") {
    assertRule(
      Number.isInteger(end.count) && end.count >= 1 && end.count <= TODO_SERIES_LIMITS.MAX_COUNT,
      "end.count",
    );
  }
}

/** 반복 규칙. 날짜는 시간대 없는 달력 값(Temporal.PlainDate)이다. 종료일만 저장 모양 그대로 YYYY-MM-DD다. */
export class RepeatRule extends ValueObject<RepeatRuleProps> {
  static #daily(end: RepeatEnd): RepeatRule {
    assertEnd(end);
    return new RepeatRule({ frequency: "DAILY", interval: 1, weekdays: null, monthDay: null, end });
  }

  static #weekly(
    weekdays: readonly DayOfWeek[],
    interval: TodoRepeatInterval,
    end: RepeatEnd,
  ): RepeatRule {
    assertRule(weekdays.length > 0, "weekdays");
    assertRule(TODO_REPEAT_INTERVALS.includes(interval), "interval");
    assertEnd(end);
    return new RepeatRule({
      frequency: "WEEKLY",
      interval,
      weekdays: DAYS_OF_WEEK.filter((weekday) => weekdays.includes(weekday)),
      monthDay: null,
      end,
    });
  }

  static #monthly(monthDay: number, end: RepeatEnd): RepeatRule {
    assertRule(
      Number.isInteger(monthDay) && 1 <= monthDay && monthDay <= TODO_REPEAT_MONTH_DAY_MAX,
      "monthDay",
    );
    assertEnd(end);
    return new RepeatRule({ frequency: "MONTHLY", interval: 1, weekdays: null, monthDay, end });
  }

  static create(spec: RepeatSpec): RepeatRule {
    return match(spec)
      .with({ frequency: "DAILY" }, ({ end }) => RepeatRule.#daily(end))
      .with({ frequency: "WEEKLY" }, ({ weekdays, interval, end }) =>
        RepeatRule.#weekly(weekdays, interval, end),
      )
      .with({ frequency: "MONTHLY" }, ({ monthDay, end }) => RepeatRule.#monthly(monthDay, end))
      .exhaustive();
  }

  static reconstitute(props: RepeatRuleProps): RepeatRule {
    return new RepeatRule({
      ...props,
      weekdays: props.weekdays == null ? null : [...props.weekdays],
    });
  }

  toPrimitives(): RepeatRuleProps {
    const { weekdays } = this.value;
    return { ...this.value, weekdays: weekdays == null ? null : [...weekdays] };
  }

  toSpec(): RepeatSpec {
    const { frequency, interval, weekdays, monthDay, end } = this.value;
    return match(frequency)
      .returnType<RepeatSpec>()
      .with("DAILY", () => ({ frequency: "DAILY", end }))
      .with("WEEKLY", () => ({
        frequency: "WEEKLY",
        interval,
        weekdays: [...(weekdays ?? [])],
        end,
      }))
      .with("MONTHLY", () => ({ frequency: "MONTHLY", monthDay: monthDay ?? 1, end }))
      .exhaustive();
  }

  /**
   * [from, through] 안의 회차 날짜. 끝이 COUNT면 generatedCount를 뺀 나머지만 돌려준다.
   * 전체를 하루씩 돌지 않고 규칙이 맞는 날짜로 바로 건너뛴다.
   */
  occurrencesBetween(range: OccurrenceRange): Temporal.PlainDate[] {
    const { seriesStart, from, through, generatedCount = 0 } = range;
    const { end } = this.value;
    const lower = later(from, seriesStart);
    const upper =
      end.type === "UNTIL" ? earlier(Temporal.PlainDate.from(end.date), through) : through;
    const limit = end.type === "COUNT" ? end.count - generatedCount : Number.POSITIVE_INFINITY;
    if (Temporal.PlainDate.compare(lower, upper) > 0 || limit <= 0) {
      return [];
    }
    const dates: Temporal.PlainDate[] = [];
    for (const date of this.#walk(seriesStart, lower, upper)) {
      dates.push(date);
      if (dates.length >= limit) {
        break;
      }
    }
    return dates;
  }

  /** date 이후(포함) 첫 회차. 끝났으면 null이다. */
  firstOnOrAfter(
    seriesStart: Temporal.PlainDate,
    date: Temporal.PlainDate,
    generatedCount = 0,
  ): Temporal.PlainDate | null {
    const from = later(date, seriesStart);
    const through = from.add({ days: TODO_REPEAT_OCCURRENCE_SEARCH_DAYS });
    return this.occurrencesBetween({ seriesStart, from, through, generatedCount }).at(0) ?? null;
  }

  /** date 전까지 만들어졌어야 할 회차 수. 이 할 일만 지운 날짜도 센다. */
  countBefore(seriesStart: Temporal.PlainDate, date: Temporal.PlainDate): number {
    return this.occurrencesBetween({
      seriesStart,
      from: seriesStart,
      through: date.subtract({ days: 1 }),
    }).length;
  }

  /** 분할할 때 앞쪽 규칙이 pivot 전날로 끝나도록 종료만 바꾼다. */
  endingBefore(date: Temporal.PlainDate): RepeatRule {
    return new RepeatRule({
      ...this.value,
      end: { type: "UNTIL", date: date.subtract({ days: 1 }).toString() },
    });
  }

  /** 분할할 때 뒤쪽 규칙이 남은 횟수를 이어받는다. 횟수 종료가 아니면 그대로다. */
  continuingFrom(seriesStart: Temporal.PlainDate, pivotDate: Temporal.PlainDate): RepeatRule {
    const { end } = this.value;
    if (end.type !== "COUNT") {
      return this;
    }
    const remaining = end.count - this.countBefore(seriesStart, pivotDate);
    return new RepeatRule({ ...this.value, end: { type: "COUNT", count: Math.max(remaining, 1) } });
  }

  *#walk(
    seriesStart: Temporal.PlainDate,
    lower: Temporal.PlainDate,
    upper: Temporal.PlainDate,
  ): Generator<Temporal.PlainDate> {
    const { frequency, interval, weekdays, monthDay } = this.value;
    yield* match(frequency)
      .with("DAILY", () => walkDaily(lower, upper))
      .with("WEEKLY", () =>
        walkWeekly({ seriesStart, lower, upper, interval, weekdays: weekdays ?? [] }),
      )
      .with("MONTHLY", () => walkMonthly(lower, upper, monthDay ?? 1))
      .exhaustive();
  }
}

function earlier(left: Temporal.PlainDate, right: Temporal.PlainDate): Temporal.PlainDate {
  return Temporal.PlainDate.compare(left, right) <= 0 ? left : right;
}

function later(left: Temporal.PlainDate, right: Temporal.PlainDate): Temporal.PlainDate {
  return Temporal.PlainDate.compare(left, right) >= 0 ? left : right;
}

function* walkDaily(
  lower: Temporal.PlainDate,
  upper: Temporal.PlainDate,
): Generator<Temporal.PlainDate> {
  for (
    let date = lower;
    Temporal.PlainDate.compare(date, upper) <= 0;
    date = date.add({ days: 1 })
  ) {
    yield date;
  }
}

function mondayOf(date: Temporal.PlainDate): Temporal.PlainDate {
  return date.subtract({ days: date.dayOfWeek - 1 });
}

/** 격주 기준 주는 시작일이 속한 주(월요일 시작)다. */
function* walkWeekly(walk: {
  readonly seriesStart: Temporal.PlainDate;
  readonly lower: Temporal.PlainDate;
  readonly upper: Temporal.PlainDate;
  readonly interval: TodoRepeatInterval;
  readonly weekdays: readonly DayOfWeek[];
}): Generator<Temporal.PlainDate> {
  const { lower, upper, interval } = walk;
  const anchorMonday = mondayOf(walk.seriesStart);
  const weeksToLower = Math.trunc(anchorMonday.until(mondayOf(lower)).days / DAYS_PER_WEEK);
  const offsets = walk.weekdays.map((weekday) => DAYS_OF_WEEK.indexOf(weekday));
  for (
    let week = weeksToLower - (weeksToLower % interval);
    Temporal.PlainDate.compare(anchorMonday.add({ weeks: week }), upper) <= 0;
    week += interval
  ) {
    const monday = anchorMonday.add({ weeks: week });
    for (const offset of offsets) {
      const date = monday.add({ days: offset });
      if (Temporal.PlainDate.compare(date, upper) > 0) {
        return;
      }
      if (Temporal.PlainDate.compare(date, lower) >= 0) {
        yield date;
      }
    }
  }
}

/** 그 날이 없는 달은 말일로 맞춘다. */
function* walkMonthly(
  lower: Temporal.PlainDate,
  upper: Temporal.PlainDate,
  monthDay: number,
): Generator<Temporal.PlainDate> {
  for (
    let month = lower.toPlainYearMonth();
    Temporal.PlainDate.compare(month.toPlainDate({ day: 1 }), upper) <= 0;
    month = month.add({ months: 1 })
  ) {
    const date = month.toPlainDate({ day: Math.min(monthDay, month.daysInMonth) });
    if (Temporal.PlainDate.compare(date, upper) > 0) {
      return;
    }
    if (Temporal.PlainDate.compare(date, lower) >= 0) {
      yield date;
    }
  }
}
