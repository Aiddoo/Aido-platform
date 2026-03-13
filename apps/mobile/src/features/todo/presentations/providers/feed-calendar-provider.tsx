import type { CalendarViewMode } from '@src/features/todo/presentations/components/Calendar/calendar.types';
import { useToday } from '@src/shared/hooks/useToday';
import { mmkvStorage } from '@src/shared/infra/storage/mmkv-storage';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const VIEW_MODE_STORAGE_KEY = 'aido_calendar_view_mode';
const VALID_VIEW_MODES: CalendarViewMode[] = ['week', 'month'];

function readSavedViewMode(): CalendarViewMode {
  const saved = mmkvStorage.getString(VIEW_MODE_STORAGE_KEY);

  if (saved && VALID_VIEW_MODES.includes(saved as CalendarViewMode)) {
    return saved as CalendarViewMode;
  }
  return 'week';
}

type FeedCalendarContextValue = {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  viewMode: CalendarViewMode;
  setViewMode: (mode: CalendarViewMode) => void;
};

const FeedCalendarContext = createContext<FeedCalendarContextValue | null>(null);

export function FeedCalendarProvider({ children }: { children: React.ReactNode }) {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [viewMode, setViewModeState] = useState<CalendarViewMode>(readSavedViewMode);
  const today = useToday();

  const setViewMode = useCallback((mode: CalendarViewMode) => {
    setViewModeState(mode);
    mmkvStorage.set(VIEW_MODE_STORAGE_KEY, mode);
  }, []);

  useEffect(() => {
    setSelectedDate(today);
  }, [today]);

  return (
    <FeedCalendarContext.Provider value={{ selectedDate, setSelectedDate, viewMode, setViewMode }}>
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
