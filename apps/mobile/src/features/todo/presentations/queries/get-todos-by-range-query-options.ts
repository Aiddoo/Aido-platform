import { useTodoService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { formatTime } from '@src/shared/utils/date';
import { queryOptions } from '@tanstack/react-query';

import type { TodoItem } from '../../models/todo.model';
import { TodoPolicy } from '../../models/todo.model';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

export interface TodoItemViewModel extends TodoItem {
  formattedTime: string | null;
  color: string;
}

const toViewModel = (todo: TodoItem): TodoItemViewModel => ({
  ...todo,
  formattedTime: todo.scheduledTime ? formatTime(todo.scheduledTime) : null,
  color: TodoPolicy.getColor(todo),
});

export const getTodosByRangeQueryOptions = (rangeStart: string, rangeEnd: string) => {
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
      todos: data.todos.map(toViewModel),
    }),
    staleTime: 30_000,
  });
};
