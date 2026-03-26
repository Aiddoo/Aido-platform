import { mmkvSyncStorage } from '@src/shared/infra/storage/mmkv-storage';
import {
  type CalendarViewMode,
  readCalendarViewMode,
  writeCalendarViewMode,
} from '@src/shared/preferences/calendar-view-mode.preference';
import { useCallback, useState } from 'react';

export function useCalendarViewMode(): [CalendarViewMode, (mode: CalendarViewMode) => void] {
  const [viewMode, setViewMode] = useState<CalendarViewMode>(() =>
    readCalendarViewMode(mmkvSyncStorage),
  );

  const persistViewMode = useCallback((mode: CalendarViewMode) => {
    setViewMode(mode);
    writeCalendarViewMode(mmkvSyncStorage, mode);
  }, []);

  return [viewMode, persistViewMode];
}
