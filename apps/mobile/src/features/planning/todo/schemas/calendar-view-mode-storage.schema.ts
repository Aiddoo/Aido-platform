import { z } from 'zod';

export const calendarViewModeSchema = z.enum(['week', 'month']);
export type CalendarViewMode = z.infer<typeof calendarViewModeSchema>;
