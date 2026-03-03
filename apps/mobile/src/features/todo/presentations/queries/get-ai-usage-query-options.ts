import { useTodoService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

export const getAiUsageQueryOptions = () => {
  const todoService = useTodoService();

  return queryOptions({
    queryKey: TODO_QUERY_KEYS.aiUsage(),
    queryFn: async () => {
      const result = await todoService.getAiUsage();
      return unwrap(result);
    },
    staleTime: 60 * 1000,
  });
};
