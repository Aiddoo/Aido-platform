import { useTodoService } from '@src/bootstrap/providers/di-context';
import type { TodoService } from '@src/features/planning/todo/apis/todo.service';
import { PERSISTED_QUERY_OPTIONS } from '@src/shared/constants/query-persistence';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';
import { keyBy } from 'es-toolkit';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys';
import type { DailyCompletionSummary } from '../domains/todo.model';

export type CompletionsByDate = Record<string, DailyCompletionSummary>;

export const toCompletionsViewModel = (data: {
  completions: DailyCompletionSummary[];
}): CompletionsByDate => {
  return keyBy(data.completions, (c) => c.date);
};

export function getDailyCompletionsQueryOptions(
  service: TodoService,
  { startDate, endDate }: { startDate: string; endDate: string },
) {
  return queryOptions({
    queryKey: TODO_QUERY_KEYS.completionsByRange({ startDate, endDate }),
    queryFn: async ({ signal }) => {
      const result = await service.getDailyCompletions(startDate, endDate, signal);
      return unwrap(result);
    },
    select: toCompletionsViewModel,
    ...PERSISTED_QUERY_OPTIONS,
  });
}

export function useGetDailyCompletionsQueryOptions({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  return getDailyCompletionsQueryOptions(useTodoService(), { startDate, endDate });
}
