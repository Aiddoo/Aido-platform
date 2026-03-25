import { useToday } from '@src/shared/hooks/useToday';
import { formatDate } from '@src/shared/utils/date';
import dayjs from 'dayjs';
import { useGlobalSearchParams, useNavigation } from 'expo-router';
import { useCallback } from 'react';

export function useFeedDate(): [Date, (date: Date) => void] {
  const { date: dateParam } = useGlobalSearchParams<{ date?: string }>();
  const navigation = useNavigation();
  const today = useToday();

  const parsed = dateParam ? dayjs(dateParam, 'YYYY-MM-DD', true) : null;
  const selectedDate = parsed?.isValid() ? parsed.toDate() : today;

  const setSelectedDate = useCallback(
    (date: Date) => {
      const formatted = formatDate(date);
      const todayStr = formatDate(today);
      navigation.setParams({ date: formatted === todayStr ? undefined : formatted } as never);
    },
    [navigation, today],
  );

  return [selectedDate, setSelectedDate];
}
