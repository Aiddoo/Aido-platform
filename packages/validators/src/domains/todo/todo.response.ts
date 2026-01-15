/**
 * Todo 엔티티 스키마 (응답용)
 *
 * 날짜는 ISO 8601 문자열로 직렬화
 * @see datetime.ts - Known Issue: https://github.com/colinhacks/zod/issues/4508
 */
import { z } from 'zod';
import { datetimeSchema, nullableDatetimeSchema } from '../../common/datetime';

export const todoVisibilitySchema = z.enum(['PUBLIC', 'PRIVATE']);
export type TodoVisibility = z.infer<typeof todoVisibilitySchema>;

export const todoSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
  title: z.string().max(200),
  content: z.string().max(5000).nullable(),
  color: z.string().max(7).nullable(),
  completed: z.boolean(),
  completedAt: nullableDatetimeSchema,
  startDate: datetimeSchema,
  endDate: nullableDatetimeSchema,
  scheduledTime: nullableDatetimeSchema,
  isAllDay: z.boolean(),
  visibility: todoVisibilitySchema,
  createdAt: datetimeSchema,
  updatedAt: datetimeSchema,
});

export type Todo = z.infer<typeof todoSchema>;
