import { z } from 'zod';

export const CALENDAR_VIEW_MODE_STORAGE_KEY = 'aido_calendar_view_mode';

const DEFAULT_VIEW_MODE = 'week';

export const calendarViewModeSchema = z.enum(['week', 'month']);
export type CalendarViewMode = z.infer<typeof calendarViewModeSchema>;

export function parseCalendarViewMode(saved: string | undefined): CalendarViewMode {
  return calendarViewModeSchema.catch(DEFAULT_VIEW_MODE).parse(saved);
}
