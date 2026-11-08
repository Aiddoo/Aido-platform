import { createTodoItemSchema } from '@aido/api';
import { z } from 'zod';

/** 앞뒤 공백을 지운 뒤 계약의 길이 규칙을 본다. 공백만 있는 제목은 빈 제목이다 */
export const subTodoFormSchema = z.object({
  title: z.string().trim().pipe(createTodoItemSchema.shape.title),
});
export type SubTodoFormValues = z.infer<typeof subTodoFormSchema>;
