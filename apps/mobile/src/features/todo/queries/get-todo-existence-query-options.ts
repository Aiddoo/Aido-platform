import { useTodoService } from '@src/bootstrap/providers/di-context';
import type { TodoService } from '@src/features/todo/apis/todo.service';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys';

export function getTodoExistenceQueryOptions(todoService: TodoService) {
  return queryOptions({
    queryKey: TODO_QUERY_KEYS.existence(),
    queryFn: async ({ signal }) => unwrap(await todoService.getTodoExistence(signal)),
  });
}

export function useGetTodoExistenceQueryOptions() {
  return getTodoExistenceQueryOptions(useTodoService());
}
