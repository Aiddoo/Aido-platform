import { useSyncStorage } from '@src/shared/di/shared-di-context';
import { useSyncStorageString } from '@src/shared/hooks/use-sync-storage-string';

import { type CalendarViewMode, parseCalendarViewMode } from '../schemas/calendar-view-mode.schema';

const CALENDAR_VIEW_MODE_STORAGE_KEY = 'aido_calendar_view_mode';

export function useCalendarViewMode() {
  const syncStorage = useSyncStorage();
  const [saved, setViewMode] = useSyncStorageString(syncStorage, CALENDAR_VIEW_MODE_STORAGE_KEY);
  const viewMode: CalendarViewMode = parseCalendarViewMode(saved);

  return [viewMode, setViewMode] as const;
}
