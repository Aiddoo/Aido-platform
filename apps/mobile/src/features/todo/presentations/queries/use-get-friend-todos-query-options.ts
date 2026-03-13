import { useTodoService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import type { TimeFormat } from '@src/shared/utils/time';
import { keepPreviousData, queryOptions } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';
import { toTodoItemViewModel } from '../view-models/todo-item.view-model';

export const useGetFriendTodosQueryOptions = (
  friendUserId: string,
  date: string,
  timeFormat: TimeFormat = 'TWELVE_HOUR',
) => {
  const todoService = useTodoService();

  return queryOptions({
    queryKey: TODO_QUERY_KEYS.friendListByDate(friendUserId, date),
    queryFn: async () => {
      const result = await todoService.getFriendTodos(friendUserId, {
        startDate: date,
        endDate: date,
        size: 200,
      });
      return unwrap(result);
    },
    select: (data) => ({
      todos: data.todos.map((todo) => toTodoItemViewModel(todo, timeFormat)),
    }),
    placeholderData: keepPreviousData,
  });
};
