import { createTodoSchema, type DayOfWeek, dayOfWeekSchema } from '@aido/api';
import { t } from '@src/shared/i18n';
import { z } from 'zod';

const { title, categoryId, scheduledTime, isAllDay, visibility } = createTodoSchema.shape;

const todoSourceSchema = z.enum(['manual', 'ai']).default('manual');

export const addTodoFormSchema = z
  .object({
    title,
    startDate: z.date(),
    endDate: z.date().nullable().default(null),
    scheduledTime,
    isAllDay,
    visibility,
    categoryId,
    isRecurring: z.boolean().default(false),
    repeatEndDate: z.date().nullable().default(null),
    daysOfWeek: z.array(dayOfWeekSchema).default([]),
    source: todoSourceSchema,
  })
  .refine((data) => !data.isRecurring || data.repeatEndDate != null, {
    error: () => t('todo:form.repeatEndDateRequired'),
    path: ['repeatEndDate'],
  })
  .refine((data) => !data.isRecurring || data.daysOfWeek.length > 0, {
    error: () => t('todo:form.repeatDaysRequired'),
    path: ['daysOfWeek'],
  });

export type AddTodoFormValues = z.input<typeof addTodoFormSchema>;
export type AddTodoFormInput = z.output<typeof addTodoFormSchema>;
export type { DayOfWeek };
