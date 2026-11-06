import type { ObservableSyncStorage, SyncStorage } from '@src/core/ports/sync-storage';
import { z } from 'zod';

export const calendarViewModeSchema = z.enum(['week', 'month']);
export type CalendarViewMode = z.infer<typeof calendarViewModeSchema>;

const KEY = 'aido_calendar_view_mode';
const DEFAULT_VIEW_MODE: CalendarViewMode = 'week';

export function readCalendarViewMode(storage: SyncStorage): CalendarViewMode {
  return calendarViewModeSchema.catch(DEFAULT_VIEW_MODE).parse(storage.get(KEY));
}

export function writeCalendarViewMode(storage: SyncStorage, mode: CalendarViewMode): void {
  storage.set(KEY, mode);
}

export function subscribeCalendarViewMode(storage: ObservableSyncStorage, listener: () => void) {
  return storage.subscribe(KEY, listener);
}
