import { useFeedDate } from '@src/features/todo/presentations/hooks/use-feed-date';
import { getCalendarRange, getWeekRange } from '@src/shared/utils/date';
import { useMemo } from 'react';
import { match } from 'ts-pattern';

import { useCalendarContext } from './calendar-view-mode-context';

/** 현재 뷰 모드(주/월)에 해당하는 캘린더 조회 범위 */
export function useCalendarRange() {
  const [selectedDate] = useFeedDate();
  const { viewMode } = useCalendarContext();

  return useMemo(
    () =>
      match(viewMode)
        .with('week', () => getWeekRange(selectedDate))
        .with('month', () => getCalendarRange(selectedDate))
        .exhaustive(),
    [viewMode, selectedDate],
  );
}
