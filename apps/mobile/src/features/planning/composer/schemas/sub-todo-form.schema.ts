import { createTodoItemSchema } from '@aido/api';
import type { z } from 'zod';

export const subTodoFormSchema = createTodoItemSchema;
export type SubTodoFormValues = z.infer<typeof subTodoFormSchema>;
