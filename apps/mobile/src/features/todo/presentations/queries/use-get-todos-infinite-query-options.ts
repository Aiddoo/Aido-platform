import { useTodoService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import type { TimeFormat } from '@src/shared/utils/time';
import { infiniteQueryOptions } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';
import { toTodoItemViewModel } from '../view-models/todo-item.view-model';

export const useGetTodosInfiniteQueryOptions = (
  date: string,
  categoryId?: number,
  timeFormat: TimeFormat = 'TWELVE_HOUR',
) => {
  const todoService = useTodoService();

  return infiniteQueryOptions({
    queryKey:
      categoryId != null
        ? TODO_QUERY_KEYS.listByDateAndCategory(date, categoryId)
        : TODO_QUERY_KEYS.listByDate(date),
    queryFn: async ({ pageParam }) => {
      const result = await todoService.getTodos({
        startDate: date,
        endDate: date,
        categoryId,
        cursor: pageParam,
        size: 20,
      });
      return unwrap(result);
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasNext ? lastPage.nextCursor : undefined),
    select: (data) => ({
      todos: data.pages.flatMap((page) =>
        page.todos.map((todo) => toTodoItemViewModel(todo, timeFormat)),
      ),
      hasNextPage: data.pages.at(-1)?.hasNext ?? false,
    }),
  });
};
