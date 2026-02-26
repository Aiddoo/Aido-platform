import type { CalendarViewMode } from '@src/features/todo/presentations/components/Calendar/calendar.types';
import { useToday } from '@src/shared/hooks/useToday';
import { createContext, useContext, useEffect, useState } from 'react';

type FeedCalendarContextValue = {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  viewMode: CalendarViewMode;
  setViewMode: (mode: CalendarViewMode) => void;
};

const FeedCalendarContext = createContext<FeedCalendarContextValue | null>(null);

export function FeedCalendarProvider({ children }: { children: React.ReactNode }) {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const today = useToday();

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
