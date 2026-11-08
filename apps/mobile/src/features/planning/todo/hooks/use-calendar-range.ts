import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useMemo } from 'react';
import { match } from 'ts-pattern';

import { getCalendarRange, getWeekRange } from '../utils/calendar-grid';
import { useCalendarViewMode } from './use-calendar-view-mode';
import { useFeedDate } from './use-feed-params';

export function useCalendarRange() {
  const [selectedDate] = useFeedDate();
  const [viewMode] = useCalendarViewMode();
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
