import { DAYS_OF_WEEK, TODO_EDIT_SCOPES, TODO_UPDATE_SCOPES } from '@aido/api/vocabulary';
import { z } from 'zod';

import { TODO_REPEAT_COUNT } from '../constants/todo-repeat.constants';

const todoEditScopeSchema = z.enum(TODO_EDIT_SCOPES);
export type TodoEditScope = z.infer<typeof todoEditScopeSchema>;
/** 수정에는 전체 범위가 없다. 첫 회차에서 이후를 고르면 전체를 고친 것과 같다 */
const todoUpdateScopeSchema = z.enum(TODO_UPDATE_SCOPES);
export type TodoUpdateScope = z.infer<typeof todoUpdateScopeSchema>;

const todoRepeatEndSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('NEVER') }),
  z.object({ type: z.literal('UNTIL'), date: z.iso.date() }),
  z.object({
    type: z.literal('COUNT'),
    count: z.int().min(TODO_REPEAT_COUNT.MIN).max(TODO_REPEAT_COUNT.MAX),
  }),
]);
export type TodoRepeatEnd = z.infer<typeof todoRepeatEndSchema>;

export const todoRepeatSchema = z.discriminatedUnion('frequency', [
  z.object({ frequency: z.literal('DAILY'), end: todoRepeatEndSchema }),
  z.object({
    frequency: z.literal('WEEKLY'),
    interval: z.union([z.literal(1), z.literal(2)]),
    weekdays: z.array(z.enum(DAYS_OF_WEEK)).min(1),
    end: todoRepeatEndSchema,
  }),
  z.object({
    frequency: z.literal('MONTHLY'),
    monthDay: z.int().min(1).max(31),
    end: todoRepeatEndSchema,
  }),
]);
export type TodoRepeat = z.infer<typeof todoRepeatSchema>;

const todoSeriesSchema = z.object({
  id: z.string(),
  repeat: todoRepeatSchema,
  startDate: z.iso.date(),
});
export type TodoSeries = z.infer<typeof todoSeriesSchema>;
