import { useLocalDate } from '@src/shared/providers/local-date-provider';
import { formatDate, toDate } from '@src/shared/utils/date';
import { createContext, type PropsWithChildren, useCallback, useContext, useMemo } from 'react';

type FeedDateContextValue = {
  selectedDate: Date;
  selectedDateKey: string;
  setSelectedDate: (date: Date) => void;
};

type FeedDateProviderProps = PropsWithChildren<{
  date?: string;
  onDateChange: (date: string | undefined) => void;
}>;

const FeedDateContext = createContext<FeedDateContextValue | null>(null);

export function FeedDateProvider({ children, date, onDateChange }: FeedDateProviderProps) {
  const { currentLocalDateKey, currentTimeZone, currentUtcOffsetMinutes } = useLocalDate();
  const selectedDateKey = date === undefined || date === 'today' ? currentLocalDateKey : date;
  const selectedDate = useMemo(
    () => toDate(selectedDateKey),
    [selectedDateKey, currentTimeZone, currentUtcOffsetMinutes],
  );
  const setSelectedDate = useCallback(
    (nextDate: Date) => {
      const nextDateKey = formatDate(nextDate);
      onDateChange(nextDateKey === currentLocalDateKey ? undefined : nextDateKey);
    },
    [currentLocalDateKey, onDateChange],
  );
  const value = useMemo(
    () => ({ selectedDate, selectedDateKey, setSelectedDate }),
    [selectedDate, selectedDateKey, setSelectedDate],
  );

  return <FeedDateContext value={value}>{children}</FeedDateContext>;
}

export function useFeedDateContext(): FeedDateContextValue {
  const context = useContext(FeedDateContext);
  if (context === null) throw new Error('useFeedDate must be used within FeedDateProvider');
  return context;
}
