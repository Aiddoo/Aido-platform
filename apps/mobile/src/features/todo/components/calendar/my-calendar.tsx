import { useTodayKey } from '@src/shared/hooks/use-today';
import { useQuery } from '@tanstack/react-query';

import { TodoRepeatPolicy } from '../../domains/todo-repeat.model';
import { useCalendarRange } from '../../hooks/use-calendar-range';
import { useFeedDateKey } from '../../hooks/use-feed-date';
import { useGetDailyCompletionsQueryOptions } from '../../queries/get-daily-completions-query-options';
import { useCalendarContext } from '../providers/calendar-provider';
import { Calendar } from './calendar';
import { RepeatHorizonHint } from './repeat-horizon-hint';

/** 나의 일일 완료 현황을 표시하는 캘린더 */
export function MyCalendar() {
  const { rangeStart, rangeEnd } = useCalendarRange();
  const { viewMode } = useCalendarContext();
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
