import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTodayKey } from '@src/shared/hooks/use-today-key';
import { Text } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import type { ComponentProps } from 'react';

import {
  findTodoScheduleSummary,
  type TodoScheduleSummaryValue,
} from '../utils/todo-schedule-summary.view-model';

interface TodoScheduleSummaryProps extends Omit<ComponentProps<typeof Text>, 'children'> {
  value: TodoScheduleSummaryValue;
}

/** 할 일의 기간·시각·반복을 한 줄로 말한다. 말할 것이 없으면 그리지 않는다. 설정은 쓰는 화면이 미리 받아 둔다 */
export function TodoScheduleSummary({ value, ...props }: TodoScheduleSummaryProps) {
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();
  const summary = findTodoScheduleSummary(value, {
    todayKey,
    timeFormat: preference.timeFormat,
    dateFormatContext,
  });

  if (summary == null) {
    return null;
  }

  return <Text {...props}>{summary}</Text>;
}
