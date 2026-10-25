import { z } from "zod";

import type { TodoDraft } from "../../../../../domain/types/parsing/todo-draft.types.js";

/**
 * LLM 출력 schema(관대). 디코더가 강제하지 않는 길이·개수 제한은 두지 않고 서버 정규화가 맞춘다.
 * 설명은 ko/en 프롬프트에 함께 전달되므로 로케일 중립 영어로 쓴다.
 */
const dayCode = z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);

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
});

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
  relativeMinutes: z.number().int().optional().describe("'in 2 hours' = 120."),
});

export const repeatRefSchema = z.object({
  pattern: z.enum([
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
  ]),
  daysOfWeek: z.array(dayCode).optional().describe("WEEKLY_DAYS only."),
  until: dateRefSchema.optional().describe("Only when an end of the repetition is stated."),
  forDuration: z
    .object({ unit: z.enum(["DAY", "WEEK", "MONTH"]), amount: z.number().int() })
    .optional(),
});

export const todoDraftSchema = z.object({
  intent: z.enum(["TASK", "NO_ACTION"]),
  title: z.string().describe("Core action only, in the input's language."),
  date: dateRefSchema,
  endDate: dateRefSchema.optional().describe("Only for 'until X', 'from A to B', 'for N days'."),
  time: timeRefSchema.nullable().describe("null when no time is mentioned (all-day)."),
  repeat: repeatRefSchema,
  categoryId: z.number().int().optional().describe("One id from context.categories, or omit."),
}) satisfies z.ZodType<TodoDraft>;

export const memoDraftSchema = z.object({
  todos: z
    .array(
      todoDraftSchema.extend({
        items: z
          .array(z.object({ title: z.string() }))
          .describe("Explicit sub-steps only; [] for a single action."),
      }),
    )
    .describe("Independent to-dos in memo order. Never group them."),
});

export type MemoDraft = z.infer<typeof memoDraftSchema>;
