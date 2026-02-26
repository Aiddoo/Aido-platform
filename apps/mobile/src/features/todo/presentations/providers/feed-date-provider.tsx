import { useToday } from '@src/shared/hooks/useToday';
import { createContext, useContext, useEffect, useState } from 'react';

type FeedDateContextValue = {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
};

const FeedDateContext = createContext<FeedDateContextValue | null>(null);

export function FeedDateProvider({ children }: { children: React.ReactNode }) {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const today = useToday();

  useEffect(() => {
    setSelectedDate(today);
  }, [today]);

  return (
    <FeedDateContext.Provider value={{ selectedDate, setSelectedDate }}>
      {children}
    </FeedDateContext.Provider>
  );
}

export function useFeedDate(): FeedDateContextValue {
  const ctx = useContext(FeedDateContext);
  if (!ctx) {
    throw new Error('useFeedDate must be used within a FeedDateProvider');
  }
  return ctx;
}
