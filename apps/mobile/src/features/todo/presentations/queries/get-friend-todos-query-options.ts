import { useTodoService } from '@src/bootstrap/providers/di-context';
import type { TodoService } from '@src/features/todo/services/todo.service';
import { unwrap } from '@src/shared/errors/result';
import type { TimeFormat } from '@src/shared/utils/time';
import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { groupBy } from 'es-toolkit';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';
import { type TodoItemViewModel, toTodoItemViewModel } from '../view-models/todo-item.view-model';

export interface FriendCategoryGroup {
  category: { id: number; name: string; color: string };
  todos: TodoItemViewModel[];
}

export function getFriendTodosQueryOptions(
  todoService: TodoService,
  {
    friendUserId,
    date,
    timeFormat = 'TWELVE_HOUR',
  }: { friendUserId: string; date: string; timeFormat?: TimeFormat },
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
    select: (data): FriendCategoryGroup[] => {
      const viewModels = data.todos.map((todo) => toTodoItemViewModel(todo, timeFormat));
      const grouped = groupBy(viewModels, (todo) => todo.category.id);
      return Object.values(grouped).flatMap((todos) => {
        const first = todos[0];
        return first
          ? [
              {
                category: {
                  id: first.category.id,
                  name: first.category.name,
                  color: first.category.color,
                },
                todos,
              },
            ]
          : [];
      });
    },
    placeholderData: keepPreviousData,
  });
}

export function useGetFriendTodosQueryOptions(
  friendUserId: string,
  date: string,
  timeFormat: TimeFormat = 'TWELVE_HOUR',
) {
  return getFriendTodosQueryOptions(useTodoService(), { friendUserId, date, timeFormat });
}
