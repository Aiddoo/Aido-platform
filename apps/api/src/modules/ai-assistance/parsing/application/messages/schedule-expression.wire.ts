import { DAYS_OF_WEEK } from "@aido/api/vocabulary";
import { z } from "zod";

import {
  llmInteger,
  llmObject,
  nullableLlmObject,
} from "../../../generation/application/messages/llm-output.wire.js";
import {
  DATE_REF_KINDS,
  type DateRef,
  PARTS_OF_DAY,
  type PlanRepeatRef,
  REPEAT_DURATION_UNITS,
  type RepeatPattern,
  type RepeatRef,
  TIME_MERIDIEMS,
  type TimeRef,
} from "../../../shared/domain/todo-draft.constants.js";

/**
 * 일정 표현 LLM schema(관대). 모델은 날짜를 계산하지 않고 표현 종류와 말한 숫자만 낸다.
 * 디코더가 강제하지 않는 범위·개수 제한은 두지 않고 서버 resolver·정규화가 맞춘다.
 * 설명은 ko/en 프롬프트에 함께 전달되므로 로케일 중립 영어로 쓴다.
 */
const dayCode = z.enum(DAYS_OF_WEEK);

const dateRefShape = {
  kind: z
    .enum(DATE_REF_KINDS)
    .describe("Kind of date expression in the input. NONE when no date is mentioned."),
  amount: llmInteger()
    .nullable()
    .describe("OFFSET_*: N (tomorrow = 1). MONTH_*/YEAR_*: 0 = this, 1 = next. Otherwise null."),
  weekday: dayCode.nullable().describe("WEEKDAY only. Otherwise null."),
  weekOffset: llmInteger()
    .nullable()
    .describe(
      "WEEKDAY only: 1 = next week, 2 = the week after next. null for a bare weekday or 'this Friday'.",
    ),
  month: llmInteger().nullable().describe("CALENDAR_DATE: 1-12. null when not stated."),
  day: llmInteger().nullable().describe("CALENDAR_DATE: 1-31. Otherwise null."),
  year: llmInteger().nullable().describe("CALENDAR_DATE: only when the year is stated, or null."),
};

export const dateRefSchema = llmObject(dateRefShape) satisfies z.ZodType<DateRef>;

/** date처럼 끝이 있을 때만 쓰는 표현. 없으면 null이다. */
export const nullableDateRefSchema = nullableLlmObject(
  dateRefShape,
) satisfies z.ZodType<DateRef | null>;

export const nullableTimeRefSchema = nullableLlmObject({
  hour: llmInteger()
    .nullable()
    .describe("Hour exactly as said (0-23). null when only a part of day is said."),
  minute: llmInteger().nullable(),
  meridiem: z.enum(TIME_MERIDIEMS).nullable().describe("NONE when AM/PM is not stated."),
  partOfDay: z.enum(PARTS_OF_DAY).nullable(),
  relativeMinutes: llmInteger()
    .nullable()
    .describe("Only for time from now, 1 or more ('in 2 hours' = 120). null otherwise."),
}).describe("null when no time is mentioned (all-day).") satisfies z.ZodType<TimeRef | null>;

/** 출시 parse 응답(요일 + 종료일)이 나타낼 수 있는 반복. 격주·매월은 UNSUPPORTED로 받는다. */
const PARSE_REPEAT_PATTERNS = [
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
  until: nullableDateRefSchema.describe(
    "Only when an end of the repetition is stated ('until the end of next month'), or null.",
  ),
  forDuration: nullableLlmObject({
    unit: z.enum(REPEAT_DURATION_UNITS),
    amount: llmInteger(),
  }).describe(
    "Only when the length of the repetition is stated ('for a month' = MONTH 1), or null. Never how long one occurrence takes ('30 minutes').",
  ),
};

export const repeatRefSchema = llmObject({
  pattern: z.enum(PARSE_REPEAT_PATTERNS),
  daysOfWeek: z.array(dayCode).nullable().describe("WEEKLY_DAYS only. Otherwise null."),
  ...repeatEnd,
}) satisfies z.ZodType<RepeatRef>;

export const planRepeatRefSchema = llmObject({
  pattern: z.enum(PLAN_REPEAT_PATTERNS),
  daysOfWeek: z
    .array(dayCode)
    .nullable()
    .describe("WEEKLY_DAYS and BIWEEKLY_DAYS only. Otherwise null."),
  monthDay: llmInteger().nullable().describe("MONTHLY_DAY only: day of the month, 1-31, or null."),
  ...repeatEnd,
}) satisfies z.ZodType<PlanRepeatRef>;
