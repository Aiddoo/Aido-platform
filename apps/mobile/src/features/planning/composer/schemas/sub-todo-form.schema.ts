import { createTodoItemSchema } from '@aido/api';
import { trimmed } from '@src/shared/schemas/trimmed.schema';
import { z } from 'zod';

export const subTodoFormSchema = z.object({
  title: trimmed(createTodoItemSchema.shape.title),
});
export type SubTodoFormValues = z.infer<typeof subTodoFormSchema>;
