import { useSubTodoService } from '@src/bootstrap/providers/di-provider';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { SubTodoPolicy } from '../../models/sub-todo.model';
import type { TodosResult } from '../../models/todo.model';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

interface ToggleSubTodoParams {
  todoId: number;
  subTodoId: number;
  completed: boolean;
  startDate: string;
}

export const useToggleSubTodoMutationOptions = () => {
  const subTodoService = useSubTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: async ({ todoId, subTodoId, completed }: ToggleSubTodoParams) => {
      const result = await subTodoService.updateSubTodo(todoId, subTodoId, { completed });
      return unwrap(result);
    },
    onMutate: async ({ todoId, subTodoId, completed, startDate }) => {
      await queryClient.cancelQueries({ queryKey: TODO_QUERY_KEYS.listByDate(startDate) });

      const previousData = queryClient.getQueryData<TodosResult>(
        TODO_QUERY_KEYS.listByDate(startDate),
      );

      queryClient.setQueryData<TodosResult>(TODO_QUERY_KEYS.listByDate(startDate), (old) => {
        if (!old) {
          return old;
        }
        return {
          ...old,
          todos: old.todos.map((todo) => {
            if (todo.id !== todoId) {
              return todo;
            }
            return {
              ...todo,
              subTodos: todo.subTodos.map((subTodo) =>
                subTodo.id === subTodoId ? { ...subTodo, completed } : subTodo,
              ),
              subTodoStats: SubTodoPolicy.statsAfterToggle(todo, completed),
            };
          }),
        };
      });

      return { previousData, startDate };
    },
    onSuccess: (_data, { todoId, subTodoId, completed }) => {
      trackEvent('todo_item_completed', {
        todo_id: todoId,
        item_id: subTodoId,
        is_completed: completed,
      });
    },
    onError: (_error, _variables, context) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (context) {
        queryClient.setQueryData(
          TODO_QUERY_KEYS.listByDate(context.startDate),
          context.previousData,
        );
      }
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.lists() });
    },
  });
};
