import type { SyncStorage } from '@src/core/ports/sync-storage';
import { useToday } from '@src/shared/hooks/useToday';
import { mmkvSyncStorage } from '@src/shared/infra/storage/mmkv-storage';
import {
  type CalendarViewMode,
  readCalendarViewMode,
  writeCalendarViewMode,
} from '@src/shared/preferences/calendar-view-mode.preference';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type FeedCalendarContextValue = {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  viewMode: CalendarViewMode;
  setViewMode: (mode: CalendarViewMode) => void;
};

const FeedCalendarContext = createContext<FeedCalendarContextValue | null>(null);

interface FeedCalendarProviderProps {
  children: React.ReactNode;
  syncStorage?: SyncStorage;
}

export function FeedCalendarProvider({
  children,
  syncStorage = mmkvSyncStorage,
}: FeedCalendarProviderProps) {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>(() =>
    readCalendarViewMode(syncStorage),
  );
  const today = useToday();

  const persistViewMode = useCallback(
    (mode: CalendarViewMode) => {
      setViewMode(mode);
      writeCalendarViewMode(syncStorage, mode);
    },
    [syncStorage],
  );

  useEffect(() => {
    setSelectedDate(today);
  }, [today]);

  return (
    <FeedCalendarContext.Provider
      value={{ selectedDate, setSelectedDate, viewMode, setViewMode: persistViewMode }}
    >
      {children}
    </FeedCalendarContext.Provider>
  );
}

export function useFeedCalendar(): FeedCalendarContextValue {
  const ctx = useContext(FeedCalendarContext);
  if (!ctx) {
    throw new Error('useFeedCalendar must be used within a FeedCalendarProvider');
  }
  return ctx;
}
