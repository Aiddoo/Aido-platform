import { DAYS_OF_WEEK, TODO_REPEAT_END_TYPES } from '@aido/api/vocabulary';
import { z } from 'zod';

export const todoRepeatFormSchema = z.object({
  startDate: z.date(),
  weekdays: z.array(z.enum(DAYS_OF_WEEK)),
  interval: z.union([z.literal(1), z.literal(2)]),
  isMonthly: z.boolean(),
  endType: z.enum(TODO_REPEAT_END_TYPES),
  untilDate: z.date().nullable(),
  count: z.int(),
});

export type TodoRepeatFormValues = z.input<typeof todoRepeatFormSchema>;
