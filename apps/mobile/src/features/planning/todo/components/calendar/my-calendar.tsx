import { useTodayKey } from '@src/shared/hooks/use-today';
import { useStoredValue } from '@src/shared/storage/use-stored-value';
import { Box } from '@src/shared/ui';
import type { ComponentProps } from 'react';
import { match } from 'ts-pattern';

import { TodoRepeatPolicy } from '../../domains/todo-repeat.model';
import { useFeedDateKey } from '../../hooks/use-feed-params';
import { useCalendarCompletions } from '../../queries/todo.queries';
import { calendarViewModeStoredValue } from '../../schemas/calendar-view-mode-storage.schema';
import { Calendar } from './calendar';
import { RepeatHorizonHint } from './repeat-horizon-hint';

export function MyCalendar({
  shouldShowHint,
}: Pick<ComponentProps<typeof RepeatHorizonHint>, 'shouldShowHint'>) {
  const [viewMode] = useStoredValue(calendarViewModeStoredValue);
  const [selectedDateKey] = useFeedDateKey();
  const todayKey = useTodayKey();
  const calendar = useCalendarCompletions({ dateKey: selectedDateKey });
  // 월 보기는 그 달이 일부라도 넘어가면(점이 끊겨 보인다), 주 보기는 고른 날이 넘어가면 안내한다
  const isHorizonHintVisible = match(viewMode)
    .with('month', () => TodoRepeatPolicy.isMonthBeyondRepeatHorizon(selectedDateKey, todayKey))
    .with('week', () => TodoRepeatPolicy.isBeyondRepeatHorizon(selectedDateKey, todayKey))
    .exhaustive();

  const status = match({ isError: calendar.isError, isHorizonHintVisible })
    .with({ isError: true }, () => <Calendar.Error onRetry={calendar.refetch} />)
    .with({ isHorizonHintVisible: true }, () => (
      <Box className="items-start">
        <RepeatHorizonHint shouldShowHint={shouldShowHint} />
      </Box>
    ))
    .otherwise(() => undefined);

  return <Calendar completions={calendar.completions} status={status} />;
}
