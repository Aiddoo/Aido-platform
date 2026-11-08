import { useTodayKey } from '@src/shared/hooks/use-today';
import { Box } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { match } from 'ts-pattern';

import { TodoRepeatPolicy } from '../../domains/todo-repeat.model';
import { useCalendarRange } from '../../hooks/use-calendar-range';
import { useCalendarViewMode } from '../../hooks/use-calendar-view-mode';
import { useFeedDateKey } from '../../hooks/use-feed-params';
import { useGetDailyCompletionsQueryOptions } from '../../queries/todo.queries';
import { Calendar } from './calendar';
import { RepeatHorizonHint } from './repeat-horizon-hint';

/** 나의 일일 완료 현황을 표시하는 캘린더 */
export function MyCalendar() {
  const [{ rangeStart, rangeEnd }] = useCalendarRange();
  const [viewMode] = useCalendarViewMode();
  const [selectedDateKey] = useFeedDateKey();
  const todayKey = useTodayKey();
  const query = useQuery(
    useGetDailyCompletionsQueryOptions({ startDate: rangeStart, endDate: rangeEnd }),
  );
  // 월 보기는 그 달이 일부라도 넘어가면(점이 끊겨 보인다), 주 보기는 고른 날이 넘어가면 안내한다
  const isHorizonHintVisible = match(viewMode)
    .with('month', () => TodoRepeatPolicy.isMonthBeyondRepeatHorizon(selectedDateKey, todayKey))
    .with('week', () => TodoRepeatPolicy.isBeyondRepeatHorizon(selectedDateKey, todayKey))
    .exhaustive();

  const status = match({ isError: query.isError, isHorizonHintVisible })
    .with({ isError: true }, () => <Calendar.Error onRetry={() => query.refetch()} />)
    .with({ isHorizonHintVisible: true }, () => (
      <Box className="mx-4 items-start">
        <RepeatHorizonHint />
      </Box>
    ))
    .otherwise(() => undefined);

  return <Calendar completions={query.data} status={status} />;
}
