import { parsedTodoDataSchema, parseTodoMetaSchema, todoRecurrenceSchema } from '@aido/api';
import { z } from 'zod';

export const parsedTodoRecurrenceSchema = todoRecurrenceSchema.extend({ endDate: z.date() });
export type ParsedTodoRecurrence = z.infer<typeof parsedTodoRecurrenceSchema>;

export const parsedTodoSchema = parsedTodoDataSchema.extend({
  startDate: z.date(),
  endDate: z.date().nullable(),
  recurrence: parsedTodoRecurrenceSchema.nullable(),
});
export type ParsedTodo = z.infer<typeof parsedTodoSchema>;

export const parsedTodoResultSchema = z.object({
  data: parsedTodoSchema,
  meta: parseTodoMetaSchema,
});
export type ParsedTodoResult = z.infer<typeof parsedTodoResultSchema>;
