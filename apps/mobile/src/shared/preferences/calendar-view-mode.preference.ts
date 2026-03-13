import type { SyncStorage } from '@src/core/ports/sync-storage';

export type CalendarViewMode = 'week' | 'month';

const KEY = 'aido_calendar_view_mode';

export function readCalendarViewMode(storage: SyncStorage): CalendarViewMode {
  const saved = storage.getString(KEY);

  if (saved === 'week' || saved === 'month') {
    return saved;
  }

  return 'week';
}

export function writeCalendarViewMode(storage: SyncStorage, mode: CalendarViewMode): void {
  storage.set(KEY, mode);
}
