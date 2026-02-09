import { useTodoService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';
import { keyBy } from 'es-toolkit';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

export const getDailyCompletionsQueryOptions = (startDate: string, endDate: string) => {
  const service = useTodoService();

  return queryOptions({
    queryKey: TODO_QUERY_KEYS.completionsByRange(startDate, endDate),
    queryFn: async () => {
      const result = await service.getDailyCompletions(startDate, endDate);
      return unwrap(result);
    },
    select: (data) => keyBy(data.completions, (c) => c.date),
    staleTime: 30_000,
  });
};
