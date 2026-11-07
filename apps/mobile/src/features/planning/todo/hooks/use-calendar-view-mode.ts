import { useSyncStorage } from '@src/shared/di/shared-di-context';
import { useSyncStorageString } from '@src/shared/hooks/use-sync-storage-string';
import {
  CALENDAR_VIEW_MODE_STORAGE_KEY,
  type CalendarViewMode,
  parseCalendarViewMode,
} from '@src/shared/preferences/calendar-view-mode.preference';

export function useCalendarViewMode() {
  const syncStorage = useSyncStorage();
  const [saved, setViewMode] = useSyncStorageString(syncStorage, CALENDAR_VIEW_MODE_STORAGE_KEY);
  const viewMode: CalendarViewMode = parseCalendarViewMode(saved);

  return [viewMode, setViewMode] as const;
}
