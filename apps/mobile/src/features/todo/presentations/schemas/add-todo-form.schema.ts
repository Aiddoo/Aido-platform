import { z } from 'zod';

import { todoVisibilitySchema } from '../../models/todo.model';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const addTodoFormSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요').max(200, '제목은 200자 이하로 입력해주세요'),
  scheduledTime: z.string().regex(timeRegex, '시간 형식이 올바르지 않습니다 (HH:mm)').nullish(),
  isAllDay: z.boolean().default(true),
  visibility: todoVisibilitySchema.default('PUBLIC'),
  categoryId: z.number().int().default(1),
});

export type AddTodoFormInput = z.input<typeof addTodoFormSchema>;
