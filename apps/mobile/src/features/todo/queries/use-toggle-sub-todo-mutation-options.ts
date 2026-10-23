import { useSubTodoService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys';
import { SubTodoPolicy } from '../domains/sub-todo.model';
import { cancelTodoListQuery, restoreTodo, snapshotTodo, updateTodoInList } from './todo-cache';

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
      await cancelTodoListQuery(queryClient, { date: startDate });
      const snapshot = snapshotTodo(queryClient, { date: startDate, todoId });
      updateTodoInList(queryClient, { date: startDate, todoId }, (todo) => ({
        ...todo,
        subTodos: todo.subTodos.map((subTodo) =>
          subTodo.id === subTodoId ? { ...subTodo, completed } : subTodo,
        ),
        subTodoStats: SubTodoPolicy.statsAfterToggle(todo, completed),
      }));

      return { snapshot };
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
      if (context?.snapshot) {
        restoreTodo(queryClient, context.snapshot);
      }
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.lists() });
    },
    onSettled: (_data, _error, { todoId }) => {
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.details({ todoId }) });
    },
  });
};
