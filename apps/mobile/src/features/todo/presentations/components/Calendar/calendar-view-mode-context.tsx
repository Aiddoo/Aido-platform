import { mmkvSyncStorage } from '@src/shared/infra/storage/mmkv-storage';
import {
  readCalendarViewMode,
  writeCalendarViewMode,
} from '@src/shared/preferences/calendar-view-mode.preference';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import type { CalendarViewMode } from './calendar.types';

interface CalendarContextValue {
  viewMode: CalendarViewMode;
  setViewMode: (mode: CalendarViewMode) => void;
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<CalendarViewMode>(() =>
    readCalendarViewMode(mmkvSyncStorage),
  );

  const setViewMode = useCallback((mode: CalendarViewMode) => {
    setViewModeState(mode);
    writeCalendarViewMode(mmkvSyncStorage, mode);
  }, []);

  const value = useMemo(() => ({ viewMode, setViewMode }), [viewMode, setViewMode]);

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>;
}

export const useCalendarContext = (): CalendarContextValue => {
  const ctx = useContext(CalendarContext);
  if (!ctx) {
    throw new Error('Calendar 하위 컴포넌트는 <CalendarProvider> 안에서만 사용할 수 있어요');
  }
  return ctx;
};
