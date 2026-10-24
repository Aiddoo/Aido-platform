import { useQuery } from '@tanstack/react-query';
import { match } from 'ts-pattern';

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
      status={match(query)
        .with({ isError: true }, () => <Calendar.Error onRetry={() => query.refetch()} />)
        .with({ isPending: true }, () => <Calendar.MarkerLoading />)
        .otherwise(() => undefined)}
    />
  );
}
