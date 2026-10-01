import { useTodoService } from '@src/bootstrap/providers/di-context';
import type { TodoService } from '@src/features/todo/services/todo.service';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

export function getAiUsageQueryOptions(todoService: TodoService) {
  return queryOptions({
    queryKey: TODO_QUERY_KEYS.aiUsage(),
    queryFn: async ({ signal }) => {
      const result = await todoService.getAiUsage(signal);
      return unwrap(result);
    },
    staleTime: 60 * 1000,
  });
}

export function useGetAiUsageQueryOptions() {
  return getAiUsageQueryOptions(useTodoService());
}
