import { useTodoService } from '@src/bootstrap/providers/di-provider';
import { formatTime } from '@src/shared/utils/date';
import { infiniteQueryOptions } from '@tanstack/react-query';

import type { TodoItem } from '../../models/todo.model';
import { TodoPolicy } from '../../models/todo.model';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

/** Todo ViewModel (표시용) */
export interface TodoItemViewModel extends TodoItem {
  formattedTime: string | null;
  color: string;
}

const toViewModel = (todo: TodoItem): TodoItemViewModel => ({
  ...todo,
  formattedTime: todo.scheduledTime ? formatTime(todo.scheduledTime) : null,
  color: TodoPolicy.getColor(todo),
});

export const getTodosInfiniteQueryOptions = (date: string) => {
  const todoService = useTodoService();

  return infiniteQueryOptions({
    queryKey: TODO_QUERY_KEYS.byDate(date),
    queryFn: ({ pageParam }) =>
      todoService.getTodos({
        startDate: date,
        endDate: date,
        cursor: pageParam,
      }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasNext ? lastPage.nextCursor : undefined),
    select: (data) => ({
      todos: data.pages.flatMap((page) => page.todos.map(toViewModel)),
      hasNextPage: data.pages.at(-1)?.hasNext ?? false,
    }),
    placeholderData: (previousData) => previousData,
  });
};
