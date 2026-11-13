import { z } from "zod";

import { dateSchema } from "../../../common/datetime.js";
import {
  TODO_REPEAT_MONTH_DAY_MAX,
  TODO_SERIES_LIMITS,
} from "../../../vocabulary/todo.constants.js";
import {
  DAYS_OF_WEEK,
  TODO_EDIT_SCOPES,
  TODO_UPDATE_SCOPES,
  TODO_VISIBILITIES,
} from "../../../vocabulary/todo.types.js";
export const todoVisibilitySchema = z.enum(TODO_VISIBILITIES);
export const dayOfWeekSchema = z.enum(DAYS_OF_WEEK);

export const todoEditScopeSchema = z.enum(TODO_EDIT_SCOPES);
export const todoUpdateScopeSchema = z.enum(TODO_UPDATE_SCOPES);

const todoRepeatEndSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("NEVER").describe("계속 반복") }),
  z.object({
    type: z.literal("UNTIL").describe("날짜까지 반복"),
    date: dateSchema.describe("마지막 날짜 (YYYY-MM-DD, 그 날 포함)"),
  }),
  z.object({
    type: z.literal("COUNT").describe("정한 횟수만큼 반복"),
    count: z.number().int().min(1).max(TODO_SERIES_LIMITS.MAX_COUNT).describe("반복 횟수"),
  }),
]);

export type TodoRepeatEnd = z.infer<typeof todoRepeatEndSchema>;

export const todoRepeatSchema = z
  .discriminatedUnion("frequency", [
    z.object({ frequency: z.literal("DAILY"), end: todoRepeatEndSchema }),
    z.object({
      frequency: z.literal("WEEKLY"),
      interval: z.union([z.literal(1), z.literal(2)]).describe("1 = 매주, 2 = 격주"),
      weekdays: z.array(dayOfWeekSchema).min(1).max(7).describe("반복할 요일"),
      end: todoRepeatEndSchema,
    }),
    z.object({
      frequency: z.literal("MONTHLY"),
      monthDay: z
        .number()
        .int()
        .min(1)
        .max(TODO_REPEAT_MONTH_DAY_MAX)
        .describe("매월 반복할 날짜 (1-31, 그 날이 없는 달은 말일)"),
      end: todoRepeatEndSchema,
    }),
  ])
  .describe("반복 규칙");

export type TodoRepeat = z.infer<typeof todoRepeatSchema>;
