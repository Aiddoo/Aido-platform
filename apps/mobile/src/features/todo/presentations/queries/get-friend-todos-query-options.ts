import { useTodoService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { formatTime } from '@src/shared/utils/date';
import { queryOptions } from '@tanstack/react-query';

import type { TodoItem } from '../../models/todo.model';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

export interface FriendTodoItemViewModel extends TodoItem {
  formattedTime: string | null;
  color: string;
}

const toViewModel = (todo: TodoItem): FriendTodoItemViewModel => ({
  ...todo,
  formattedTime: todo.scheduledTime ? formatTime(todo.scheduledTime) : null,
  color: todo.category.color,
});

export const getFriendTodosQueryOptions = (friendUserId: string, date: string) => {
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
      todos: data.todos.map(toViewModel),
    }),
    staleTime: 30_000,
  });
};
