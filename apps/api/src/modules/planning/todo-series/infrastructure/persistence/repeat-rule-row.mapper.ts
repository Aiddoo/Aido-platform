import { DAYS_OF_WEEK, type DayOfWeek, type TodoRepeatInterval } from "@aido/api/vocabulary";

import type { todoSeries } from "#api/platform/database/schema/index";

import { RepeatRule, type RepeatEnd } from "../../domain/repeat-rule.vo.js";

export type RepeatRuleRow = Pick<
  typeof todoSeries.$inferSelect,
  | "repeatFrequency"
  | "repeatInterval"
  | "repeatWeekdays"
  | "repeatMonthDay"
  | "repeatUntil"
  | "repeatCount"
>;

function toRepeatEnd(row: RepeatRuleRow): RepeatEnd {
  if (row.repeatUntil != null) {
    return { type: "UNTIL", date: row.repeatUntil.toString() };
  }
  if (row.repeatCount != null) {
    return { type: "COUNT", count: row.repeatCount };
  }
  return { type: "NEVER" };
}

function isDayOfWeek(value: string): value is DayOfWeek {
  return DAYS_OF_WEEK.some((weekday) => weekday === value);
}

function toInterval(value: number): TodoRepeatInterval {
  return value === 2 ? 2 : 1;
}

export function toRepeatRule(row: RepeatRuleRow): RepeatRule {
  return RepeatRule.reconstitute({
    frequency: row.repeatFrequency,
    interval: toInterval(row.repeatInterval),
    weekdays: row.repeatWeekdays?.filter(isDayOfWeek) ?? null,
    monthDay: row.repeatMonthDay,
    end: toRepeatEnd(row),
  });
}
