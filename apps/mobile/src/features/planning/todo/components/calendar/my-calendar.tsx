import { useTodayKey } from '@src/shared/hooks/use-today-key';
import { useStoredValue } from '@src/shared/storage/use-stored-value';
import { Box } from '@src/shared/ui';
import type { ReactNode } from 'react';
import { match } from 'ts-pattern';

import { isBeyondRepeatHorizon, isMonthBeyondRepeatHorizon } from '../../domains/todo-series.model';
import { useCalendarCompletions } from '../../hooks/use-calendar-completions';
import { useFeedDateKey } from '../../hooks/use-feed-params';
import { calendarViewModeStoredValue } from '../../schemas/calendar-view-mode-storage.schema';
import { Calendar } from './calendar';

interface MyCalendarProps {
  /** 반복을 미리 만드는 기간을 넘긴 날에 달력 아래에 두는 안내. 스스로 열 차례는 화면이 정해 안내에 넘긴다 */
  repeatHorizonHint: ReactNode;
}

export function MyCalendar({ repeatHorizonHint }: MyCalendarProps) {
  const [viewMode] = useStoredValue(calendarViewModeStoredValue);
  const [selectedDateKey] = useFeedDateKey();
  const todayKey = useTodayKey();
  const calendar = useCalendarCompletions({ dateKey: selectedDateKey });
  // 월 보기는 그 달이 일부라도 넘어가면(점이 끊겨 보인다), 주 보기는 고른 날이 넘어가면 안내한다
  const isHorizonHintVisible = match(viewMode)
    .with('month', () => isMonthBeyondRepeatHorizon(selectedDateKey, todayKey))
    .with('week', () => isBeyondRepeatHorizon(selectedDateKey, todayKey))
    .exhaustive();

  const status = match({ isError: calendar.isError, isHorizonHintVisible })
    .with({ isError: true }, () => <Calendar.Error onRetry={calendar.refetch} />)
    .with({ isHorizonHintVisible: true }, () => (
      <Box className="items-start">{repeatHorizonHint}</Box>
    ))
    .otherwise(() => undefined);

  return <Calendar completions={calendar.completions} status={status} />;
}
