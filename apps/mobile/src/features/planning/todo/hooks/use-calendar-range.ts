import { useFeedDateParam } from '@src/features/planning/todo/hooks/use-feed-params';
import { getCalendarRange, getWeekRange } from '@src/features/planning/todo/utils/calendar-date';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useMemo } from 'react';
import { match } from 'ts-pattern';

import { useCalendarViewMode } from './use-calendar-view-mode';

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
