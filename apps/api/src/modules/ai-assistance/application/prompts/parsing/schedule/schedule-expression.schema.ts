import { DAYS_OF_WEEK } from "@aido/api/vocabulary";
import { z } from "zod";

import type {
  DateRef,
  RepeatPattern,
  RepeatRef,
  TimeRef,
} from "../../../../domain/types/parsing/todo-draft.types.js";

/**
 * 일정 표현 LLM schema(관대). 모델은 날짜를 계산하지 않고 표현 종류와 말한 숫자만 낸다.
 * 디코더가 강제하지 않는 범위·개수 제한은 두지 않고 서버 resolver·정규화가 맞춘다.
 * 설명은 ko/en 프롬프트에 함께 전달되므로 로케일 중립 영어로 쓴다.
 */
const dayCode = z.enum(DAYS_OF_WEEK);

export const dateRefSchema = z.object({
  kind: z
    .enum([
      "NONE",
      "TODAY",
      "OFFSET_DAYS",
      "OFFSET_WEEKS",
      "OFFSET_MONTHS",
      "WEEKDAY",
      "CALENDAR_DATE",
      "MONTH_START",
      "MONTH_END",
      "YEAR_START",
      "YEAR_END",
    ])
    .describe("Kind of date expression in the input. NONE when no date is mentioned."),
  amount: z
    .number()
    .int()
    .optional()
    .describe("OFFSET_*: N (tomorrow = 1). MONTH_*/YEAR_*: 0 = this, 1 = next."),
  weekday: dayCode.optional().describe("WEEKDAY only."),
  weekOffset: z
    .number()
    .int()
    .optional()
    .describe(
      "WEEKDAY only: 0 = this week, 1 = next week, 2 = the week after next. Omit for a bare weekday.",
    ),
  month: z.number().int().optional().describe("CALENDAR_DATE: 1-12. Omit when not stated."),
  day: z.number().int().optional().describe("CALENDAR_DATE: 1-31."),
  year: z.number().int().optional().describe("CALENDAR_DATE: only when the year is stated."),
}) satisfies z.ZodType<DateRef>;

export const timeRefSchema = z.object({
  hour: z
    .number()
    .int()
    .optional()
    .describe("Hour exactly as said (0-23). Omit when only a part of day is said."),
  minute: z.number().int().optional(),
  meridiem: z.enum(["AM", "PM", "NONE"]).optional().describe("NONE when AM/PM is not stated."),
  partOfDay: z
    .enum(["DAWN", "MORNING", "NOON", "AFTERNOON", "EVENING", "NIGHT", "MIDNIGHT"])
    .optional(),
  relativeMinutes: z
    .number()
    .int()
    .optional()
    .describe("Only for time from now, 1 or more ('in 2 hours' = 120). Omit otherwise."),
}) satisfies z.ZodType<TimeRef>;

/** 출시 parse 응답(요일 + 종료일)이 나타낼 수 있는 반복. 격주·매월은 UNSUPPORTED로 받는다. */
export const PARSE_REPEAT_PATTERNS = [
  "NONE",
  "WEEKLY_DAYS",
  "DAILY",
  "WEEKDAYS",
  "WEEKENDS",
  "THIS_WEEK",
  "NEXT_WEEK",
  "WEEK_AFTER_NEXT",
  "THIS_WEEKEND",
  "NEXT_WEEKEND",
  "THIS_WEEKDAYS",
  "UNSUPPORTED",
] as const satisfies readonly RepeatPattern[];

/** 반복 할 일(TodoRepeat)이 나타내는 반복 전체. 계획 프롬프트가 쓴다. */
export const PLAN_REPEAT_PATTERNS = [
  ...PARSE_REPEAT_PATTERNS,
  "BIWEEKLY_DAYS",
  "MONTHLY_DAY",
] as const satisfies readonly RepeatPattern[];

const repeatEnd = {
  until: dateRefSchema
    .optional()
    .describe("Only when an end of the repetition is stated ('until the end of next month')."),
  forDuration: z
    .object({ unit: z.enum(["DAY", "WEEK", "MONTH"]), amount: z.number().int() })
    .optional()
    .describe("Only when a length is stated ('for a month' = MONTH 1)."),
};

export const repeatRefSchema = z.object({
  pattern: z.enum(PARSE_REPEAT_PATTERNS),
  daysOfWeek: z.array(dayCode).optional().describe("WEEKLY_DAYS only."),
  ...repeatEnd,
}) satisfies z.ZodType<RepeatRef>;

export const planRepeatRefSchema = z.object({
  pattern: z.enum(PLAN_REPEAT_PATTERNS),
  daysOfWeek: z.array(dayCode).optional().describe("WEEKLY_DAYS and BIWEEKLY_DAYS only."),
  monthDay: z.number().int().optional().describe("MONTHLY_DAY only: day of the month, 1-31."),
  ...repeatEnd,
}) satisfies z.ZodType<RepeatRef>;
