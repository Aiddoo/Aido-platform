import { dateKeySchema } from '@src/shared/date/date-key';
import { z } from 'zod';

import { todoRepeatSchema } from './todo-repeat.model';

export const todoSeriesSchema = z.object({
  id: z.string(),
  repeat: todoRepeatSchema,
  startDate: dateKeySchema,
});
export type TodoSeries = z.infer<typeof todoSeriesSchema>;
