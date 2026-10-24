import { useQuery } from '@tanstack/react-query';

import { useCalendarRange } from '../../hooks/use-calendar-range';
import { useGetDailyCompletionsQueryOptions } from '../../queries/get-daily-completions-query-options';
import { Calendar } from './calendar';

/** 나의 일일 완료 현황을 표시하는 캘린더 */
export function MyCalendar() {
  const { rangeStart, rangeEnd } = useCalendarRange();
  const query = useQuery(
    useGetDailyCompletionsQueryOptions({ startDate: rangeStart, endDate: rangeEnd }),
  );

  return (
    <Calendar
      completions={query.data}
      status={query.isError ? <Calendar.Error onRetry={() => query.refetch()} /> : undefined}
    />
  );
}
