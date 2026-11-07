import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useMemo } from 'react';
import { match } from 'ts-pattern';

import { getCalendarRange, getWeekRange } from '../utils/calendar-date';
import { useCalendarViewMode } from './use-calendar-view-mode';
import { useFeedDateParam } from './use-feed-params';

/** 현재 뷰 모드(주/월)에 해당하는 캘린더 조회 범위 */
export function useCalendarRange() {
  const [selectedDate] = useFeedDateParam();
  const [viewMode] = useCalendarViewMode();
  const { timeZone } = useDateFormatContext();

  return useMemo(
    () =>
      match(viewMode)
        .with('week', () => getWeekRange(selectedDate, timeZone))
        .with('month', () => getCalendarRange(selectedDate, timeZone))
        .exhaustive(),
    [viewMode, selectedDate, timeZone],
  );
}
