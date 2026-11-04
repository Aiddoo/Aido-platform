import { parsedTodoDataSchema, parseTodoMetaSchema, todoRecurrenceSchema } from '@aido/api';
import { featureQuotaSchema } from '@src/features/subscription/domains/entitlement.model';
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
  /** 이 요청을 반영한 AI 할 일 만들기 한도. 1.15.0 이전 서버는 보내지 않는다 */
  featureQuota: featureQuotaSchema.nullable(),
});
export type ParsedTodoResult = z.infer<typeof parsedTodoResultSchema>;
