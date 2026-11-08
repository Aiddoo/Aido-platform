import { TODO_LIMITS, TODO_VISIBILITIES } from '@aido/api/vocabulary';
import { todoRepeatSchema } from '@src/features/planning/todo/schemas/todo-repeat.schema';
import { instantFieldSchema } from '@src/shared/date/instant';
import { z } from 'zod';

export const addTodoFormSchema = z.object({
  // 앞뒤 공백을 지운 뒤 길이를 본다. 공백만 있는 제목은 빈 제목이다
  title: z.string().trim().min(1).max(TODO_LIMITS.TITLE_MAX_LENGTH),
  startDate: instantFieldSchema,
  endDate: instantFieldSchema.nullable(),
  scheduledTime: z.iso.time({ precision: -1 }).nullable(),
  isAllDay: z.boolean(),
  visibility: z.enum(TODO_VISIBILITIES),
  categoryId: z.int().positive(),
  repeat: todoRepeatSchema.nullable(),
});

export type AddTodoFormValues = z.infer<typeof addTodoFormSchema>;
