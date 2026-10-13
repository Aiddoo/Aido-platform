import { type DayOfWeek, dayOfWeekSchema } from '@aido/api';
import { t } from '@src/shared/i18n';
import { z } from 'zod';

import { todoVisibilitySchema } from './todo.model';

const todoSourceSchema = z.enum(['manual', 'ai']).default('manual');

export const addTodoFormSchema = z
  .object({
    title: z
      .string()
      .min(1, { error: () => t('todo:form.titleRequired') })
      .max(200, { error: () => t('todo:form.titleMaxLength') }),
    startDate: z.date(),
    endDate: z.date().nullable().default(null),
    scheduledTime: z.iso
      .time({ precision: -1, error: () => t('todo:form.timeFormatInvalid') })
      .nullish(),
    isAllDay: z.boolean().default(true),
    visibility: todoVisibilitySchema.default('PUBLIC'),
    categoryId: z.int(),
    isRecurring: z.boolean().default(false),
    repeatEndDate: z.date().nullable().default(null),
    daysOfWeek: z.array(dayOfWeekSchema).default([]),
    source: todoSourceSchema,
  })
  .refine((data) => !data.isRecurring || data.repeatEndDate !== null, {
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
