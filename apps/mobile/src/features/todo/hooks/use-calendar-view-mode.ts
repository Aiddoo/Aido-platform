import { useStoredString } from '@src/shared/infra/storage/mmkv-storage';
import {
  CALENDAR_VIEW_MODE_STORAGE_KEY,
  type CalendarViewMode,
  parseCalendarViewMode,
} from '@src/shared/preferences/calendar-view-mode.preference';

export function useCalendarViewMode() {
  const [saved, setViewMode] = useStoredString(CALENDAR_VIEW_MODE_STORAGE_KEY);
  const viewMode: CalendarViewMode = parseCalendarViewMode(saved);

  return [viewMode, setViewMode] as const;
}
