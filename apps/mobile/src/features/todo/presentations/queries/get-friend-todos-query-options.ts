import { useTodoService } from '@src/bootstrap/providers/di-context';
import type { TodoService } from '@src/features/todo/services/todo.service';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';
export function getFriendTodosQueryOptions(
  todoService: TodoService,
  { friendUserId, date }: { friendUserId: string; date: string },
) {
  return queryOptions({
    queryKey: TODO_QUERY_KEYS.friendListByDate(friendUserId, date),
    queryFn: async ({ signal }) => {
      const result = await todoService.getFriendTodos(
        friendUserId,
        {
          startDate: date,
          endDate: date,
          size: 200,
        },
        signal,
      );
      return unwrap(result);
    },
  });
}

export function useGetFriendTodosQueryOptions(friendUserId: string, date: string) {
  return getFriendTodosQueryOptions(useTodoService(), { friendUserId, date });
}
