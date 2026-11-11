import { ErrorCode } from "@aido/api/errors";
import {
  DAY_OF_WEEK_ORDER,
  TODO_REPEAT_INTERVALS,
  TODO_REPEAT_MONTH_DAY_MAX,
  TODO_SERIES_LIMITS,
  type DayOfWeek,
  type TodoRepeatFrequency,
  type TodoRepeatInterval,
} from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { ValueObject } from "#api/shared/domain/model/value-object";

import { addDaysToKey } from "../../shared/domain/todo-calendar.domain-service.js";

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

export interface RepeatRuleProps {
  readonly frequency: TodoRepeatFrequency;
  readonly interval: TodoRepeatInterval;
  readonly weekdays: readonly DayOfWeek[] | null;
  readonly monthDay: number | null;
  readonly end: RepeatEnd;
}

const DAYS_PER_WEEK = 7;
/** 어떤 규칙이든 다음 회차가 이 안에 있다(격주는 3주, 매월은 말일 보정 포함 2달). */
const NEXT_OCCURRENCE_SEARCH_DAYS = 62;

function assertRule(condition: boolean, field: string): void {
  if (!condition) {
    throw new DomainException(ErrorCode.TODO_0845, { field });
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

/** 반복 규칙. 날짜는 시간대 없는 달력 값이라 모두 YYYY-MM-DD key로 계산한다. */
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
      weekdays: DAY_OF_WEEK_ORDER.filter((weekday) => weekdays.includes(weekday)),
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
  occurrencesBetween(
    seriesStart: string,
    from: string,
    through: string,
    generatedCount = 0,
  ): string[] {
    const { end } = this.value;
    const lower = from < seriesStart ? seriesStart : from;
    const upper = end.type === "UNTIL" && end.date < through ? end.date : through;
    const limit = end.type === "COUNT" ? end.count - generatedCount : Number.POSITIVE_INFINITY;
    if (lower > upper || limit <= 0) {
      return [];
    }
    const dates: string[] = [];
    for (const date of this.#walk(seriesStart, lower, upper)) {
      dates.push(date);
      if (dates.length >= limit) {
        break;
      }
    }
    return dates;
  }

  /** date 이후(포함) 첫 회차. 끝났으면 null이다. */
  firstOnOrAfter(seriesStart: string, date: string, generatedCount = 0): string | null {
    const lower = date < seriesStart ? seriesStart : date;
    const window = addDaysToKey(lower, NEXT_OCCURRENCE_SEARCH_DAYS);
    return this.occurrencesBetween(seriesStart, lower, window, generatedCount).at(0) ?? null;
  }

  /** date 전까지 만들어졌어야 할 회차 수. 이 할 일만 지운 날짜도 센다. */
  countBefore(seriesStart: string, date: string): number {
    return this.occurrencesBetween(seriesStart, seriesStart, addDaysToKey(date, -1)).length;
  }

  /** 분할할 때 앞쪽 규칙이 pivot 전날로 끝나도록 종료만 바꾼다. */
  endingBefore(date: string): RepeatRule {
    return new RepeatRule({
      ...this.value,
      end: { type: "UNTIL", date: addDaysToKey(date, -1) },
    });
  }

  /** 분할할 때 뒤쪽 규칙이 남은 횟수를 이어받는다. 횟수 종료가 아니면 그대로다. */
  continuingFrom(seriesStart: string, pivotDate: string): RepeatRule {
    const { end } = this.value;
    if (end.type !== "COUNT") {
      return this;
    }
    const remaining = end.count - this.countBefore(seriesStart, pivotDate);
    return new RepeatRule({ ...this.value, end: { type: "COUNT", count: Math.max(remaining, 1) } });
  }

  *#walk(seriesStart: string, lower: string, upper: string): Generator<string> {
    yield* match(this.value.frequency)
      .with("DAILY", () => walkDaily(lower, upper))
      .with("WEEKLY", () =>
        walkWeekly(seriesStart, lower, upper, this.value.interval, this.value.weekdays ?? []),
      )
      .with("MONTHLY", () => walkMonthly(lower, upper, this.value.monthDay ?? 1))
      .exhaustive();
  }
}

function* walkDaily(lower: string, upper: string): Generator<string> {
  const last = Temporal.PlainDate.from(upper);
  for (
    let date = Temporal.PlainDate.from(lower);
    Temporal.PlainDate.compare(date, last) <= 0;
    date = date.add({ days: 1 })
  ) {
    yield date.toString();
  }
}

function mondayOf(date: Temporal.PlainDate): Temporal.PlainDate {
  return date.subtract({ days: date.dayOfWeek - 1 });
}

/** 격주 기준 주는 시작일이 속한 주(월요일 시작)다. */
function* walkWeekly(
  seriesStart: string,
  lower: string,
  upper: string,
  interval: TodoRepeatInterval,
  weekdays: readonly DayOfWeek[],
): Generator<string> {
  const first = Temporal.PlainDate.from(lower);
  const last = Temporal.PlainDate.from(upper);
  const anchorMonday = mondayOf(Temporal.PlainDate.from(seriesStart));
  const weeksToLower = Math.trunc(anchorMonday.until(mondayOf(first)).days / DAYS_PER_WEEK);
  const offsets = weekdays.map((weekday) => DAY_OF_WEEK_ORDER.indexOf(weekday));
  for (
    let week = weeksToLower - (weeksToLower % interval);
    Temporal.PlainDate.compare(anchorMonday.add({ weeks: week }), last) <= 0;
    week += interval
  ) {
    const monday = anchorMonday.add({ weeks: week });
    for (const offset of offsets) {
      const date = monday.add({ days: offset });
      if (Temporal.PlainDate.compare(date, last) > 0) {
        return;
      }
      if (Temporal.PlainDate.compare(date, first) >= 0) {
        yield date.toString();
      }
    }
  }
}

/** 그 날이 없는 달은 말일로 맞춘다. */
function* walkMonthly(lower: string, upper: string, monthDay: number): Generator<string> {
  const first = Temporal.PlainDate.from(lower);
  const last = Temporal.PlainDate.from(upper);
  for (
    let month = first.toPlainYearMonth();
    Temporal.PlainDate.compare(month.toPlainDate({ day: 1 }), last) <= 0;
    month = month.add({ months: 1 })
  ) {
    const date = month.toPlainDate({ day: Math.min(monthDay, month.daysInMonth) });
    if (Temporal.PlainDate.compare(date, last) > 0) {
      return;
    }
    if (Temporal.PlainDate.compare(date, first) >= 0) {
      yield date.toString();
    }
  }
}
