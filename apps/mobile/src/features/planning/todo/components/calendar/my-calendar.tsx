import { useTodayKey } from '@src/shared/hooks/use-today';
import { useQuery } from '@tanstack/react-query';

import { TodoRepeatPolicy } from '../../domains/todo-repeat.model';
import { useCalendarRange } from '../../hooks/use-calendar-range';
import { useCalendarViewMode } from '../../hooks/use-calendar-view-mode';
import { useFeedDateKey } from '../../hooks/use-feed-params';
import { useGetDailyCompletionsQueryOptions } from '../../queries/todo.queries';
import { Calendar } from './calendar';
import { RepeatHorizonHint } from './repeat-horizon-hint';

/** 나의 일일 완료 현황을 표시하는 캘린더 */
export function MyCalendar() {
  const { rangeStart, rangeEnd } = useCalendarRange();
  const [viewMode] = useCalendarViewMode();
  const selectedDateKey = useFeedDateKey();
  const todayKey = useTodayKey();
  const query = useQuery(
    useGetDailyCompletionsQueryOptions({ startDate: rangeStart, endDate: rangeEnd }),
  );
  const isHorizonHintVisible = TodoRepeatPolicy.shouldShowRepeatHorizonHint(
    selectedDateKey,
    todayKey,
    viewMode,
  );

  return (
    <Calendar
      completions={query.data}
      status={
        query.isError ? (
          <Calendar.Error onRetry={() => query.refetch()} />
        ) : isHorizonHintVisible ? (
          <RepeatHorizonHint />
        ) : undefined
      }
    />
  );
}
