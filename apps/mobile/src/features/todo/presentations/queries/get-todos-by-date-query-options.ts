import { useTodoService } from '@src/bootstrap/providers/di-context';
import type { TodoService } from '@src/features/todo/services/todo.service';
import { unwrap } from '@src/shared/errors/result';
import { keepPreviousData, queryOptions } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

export function getTodosByDateQueryOptions(todoService: TodoService, { date }: { date: string }) {
  return queryOptions({
    queryKey: TODO_QUERY_KEYS.listByDate(date),
    queryFn: async ({ signal }) =>
      unwrap(await todoService.getTodos({ startDate: date, endDate: date, size: 200 }, signal)),
    placeholderData: keepPreviousData,
  });
}

export function useGetTodosByDateQueryOptions(date: string) {
  return getTodosByDateQueryOptions(useTodoService(), { date });
}
