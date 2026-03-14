import { type DayOfWeek, dayOfWeekSchema } from '@aido/validators';
import { z } from 'zod';

import { todoVisibilitySchema } from '../../models/todo.model';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const todoSourceSchema = z.enum(['manual', 'ai']).default('manual');

export const addTodoFormSchema = z
  .object({
    title: z.string().min(1, '제목을 입력해 주세요').max(200, '제목은 200자까지 입력할 수 있어요'),
    startDate: z.date(),
    endDate: z.date().nullable().default(null),
    scheduledTime: z.string().regex(timeRegex, '시간은 HH:mm 형식으로 입력해 주세요').nullish(),
    isAllDay: z.boolean().default(true),
    visibility: todoVisibilitySchema.default('PUBLIC'),
    categoryId: z.number().int(),
    isRecurring: z.boolean().default(false),
    repeatEndDate: z.date().nullable().default(null),
    daysOfWeek: z.array(dayOfWeekSchema).default([]),
    source: todoSourceSchema,
  })
  .refine((data) => !data.isRecurring || data.repeatEndDate !== null, {
    message: '반복 종료일을 선택해 주세요',
    path: ['repeatEndDate'],
  })
  .refine((data) => !data.isRecurring || data.daysOfWeek.length > 0, {
    message: '반복할 요일을 선택해 주세요',
    path: ['daysOfWeek'],
  });

export type AddTodoFormInput = z.infer<typeof addTodoFormSchema>;
export type { DayOfWeek };
