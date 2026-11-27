import { createTodoItemSchema } from '@aido/api/contracts/todo/v1';
import { trimmed } from '@src/shared/schemas/trimmed.schema';
import { z } from 'zod';

export const subTodoFormSchema = z.object({
  title: trimmed(createTodoItemSchema.shape.title),
});
