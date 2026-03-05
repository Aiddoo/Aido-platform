import { useTodoService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';
import { keyBy } from 'es-toolkit';

import type { DailyCompletionSummary } from '../../models/todo.model';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

export type CompletionsByDate = Record<string, DailyCompletionSummary>;

export const toCompletionsViewModel = (data: {
  completions: DailyCompletionSummary[];
}): CompletionsByDate => {
  return keyBy(data.completions, (c) => c.date);
};

export const useGetDailyCompletionsQueryOptions = (startDate: string, endDate: string) => {
  const service = useTodoService();

  return queryOptions({
    queryKey: TODO_QUERY_KEYS.completionsByRange(startDate, endDate),
    queryFn: async () => {
      const result = await service.getDailyCompletions(startDate, endDate);
      return unwrap(result);
    },
    select: toCompletionsViewModel,
  });
};
