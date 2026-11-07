import { useSyncStorage } from '@src/bootstrap/providers/di-context';
import { useSyncStorageString } from '@src/shared/hooks/use-sync-storage-string';

import { type CalendarViewMode, toCalendarViewMode } from '../schemas/calendar-view-mode.schema';

const CALENDAR_VIEW_MODE_STORAGE_KEY = 'aido_calendar_view_mode';

export function useCalendarViewMode() {
  const syncStorage = useSyncStorage();
  const [saved, setSaved] = useSyncStorageString(syncStorage, CALENDAR_VIEW_MODE_STORAGE_KEY);
  const viewMode: CalendarViewMode = toCalendarViewMode(saved);

  const setViewMode = (next: CalendarViewMode) => setSaved(next);

  return [viewMode, setViewMode] as const;
}
