import { useTodoService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';
import { toTodoItemViewModel } from '../view-models/todo-item.view-model';

export const useGetTodosByRangeQueryOptions = (rangeStart: string, rangeEnd: string) => {
  const todoService = useTodoService();

  return queryOptions({
    queryKey: TODO_QUERY_KEYS.byRange(rangeStart, rangeEnd),
    queryFn: async () => {
      const result = await todoService.getTodos({
        startDate: rangeStart,
        endDate: rangeEnd,
        size: 200,
      });
      return unwrap(result);
    },
    select: (data) => ({
      todos: data.todos.map(toTodoItemViewModel),
    }),
  });
};
