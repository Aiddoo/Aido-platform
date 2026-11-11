import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useStoredValue } from '@src/shared/storage/use-stored-value';
import { useMemo } from 'react';
import { match } from 'ts-pattern';

import { calendarViewModeStoredValue } from '../schemas/calendar-view-mode-storage.schema';
import { getCalendarRange, getWeekRange } from '../utils/calendar-grid';
import { useFeedDate } from './use-feed-params';

export function useCalendarRange() {
  const [selectedDate] = useFeedDate();
  const [viewMode] = useStoredValue(calendarViewModeStoredValue);
  const { timeZone } = useDateFormatContext();

  const range = useMemo(
    () =>
      match(viewMode)
        .with('week', () => getWeekRange(selectedDate, timeZone))
        .with('month', () => getCalendarRange(selectedDate, timeZone))
        .exhaustive(),
    [viewMode, selectedDate, timeZone],
  );

  return [range] as const;
}
