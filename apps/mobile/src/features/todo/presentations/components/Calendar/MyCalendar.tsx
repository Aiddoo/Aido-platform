import { useQuery } from '@tanstack/react-query';

import { useGetDailyCompletionsQueryOptions } from '../../queries/use-get-daily-completions-query-options';
import { Calendar } from './Calendar';
import { useCalendarRange } from './use-calendar-range';

/** 나의 일일 완료 현황을 표시하는 캘린더 */
export function MyCalendar() {
  const { rangeStart, rangeEnd } = useCalendarRange();
  const { data } = useQuery(useGetDailyCompletionsQueryOptions(rangeStart, rangeEnd));

  return <Calendar completions={data} />;
}
