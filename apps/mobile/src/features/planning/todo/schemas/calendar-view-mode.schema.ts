import { z } from 'zod';

const DEFAULT_VIEW_MODE = 'week';

export const calendarViewModeSchema = z.enum(['week', 'month']);
export type CalendarViewMode = z.infer<typeof calendarViewModeSchema>;

export function toCalendarViewMode(saved: string | undefined): CalendarViewMode {
  return calendarViewModeSchema.catch(DEFAULT_VIEW_MODE).parse(saved);
}
