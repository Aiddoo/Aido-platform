import { createTodoSchema } from '@aido/api';
import { z } from 'zod';

import { todoRepeatSchema } from './todo-repeat.model';

const { title, categoryId, scheduledTime, isAllDay, visibility } = createTodoSchema.shape;

const todoSourceSchema = z.literal('manual').default('manual');

export const addTodoFormSchema = z.object({
  title,
  startDate: z.date(),
  endDate: z.date().nullable().default(null),
  scheduledTime,
  isAllDay,
  visibility,
  categoryId,
  repeat: todoRepeatSchema.nullable().default(null),
  source: todoSourceSchema,
});

export type AddTodoFormValues = z.input<typeof addTodoFormSchema>;
export type AddTodoFormInput = z.output<typeof addTodoFormSchema>;
