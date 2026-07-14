import { useFeedDateContext } from '../providers/feed-date-provider';

export function useFeedDate(): [Date, (date: Date) => void] {
  const { selectedDate, setSelectedDate } = useFeedDateContext();
  return [selectedDate, setSelectedDate];
}

export function useFeedDateKey(): string {
  return useFeedDateContext().selectedDateKey;
}
