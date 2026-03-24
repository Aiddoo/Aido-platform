import { useSubTodoService } from '@src/bootstrap/providers/di-provider';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import type { TodosResult } from '../../models/todo.model';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

interface ReorderSubTodosParams {
  todoId: number;
  subTodoIds: number[];
  startDate: string;
}

export const useReorderSubTodosMutationOptions = () => {
  const subTodoService = useSubTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: async ({ todoId, subTodoIds }: ReorderSubTodosParams) => {
      const result = await subTodoService.reorderSubTodos(todoId, { itemIds: subTodoIds });
      return unwrap(result);
    },
    onMutate: ({ todoId, subTodoIds, startDate }) => {
      queryClient.cancelQueries({ queryKey: TODO_QUERY_KEYS.listByDate(startDate) });

      const previous = queryClient.getQueryData<TodosResult>(TODO_QUERY_KEYS.listByDate(startDate));

      queryClient.setQueryData<TodosResult>(TODO_QUERY_KEYS.listByDate(startDate), (old) => {
        if (!old) return old;
        return {
          ...old,
          todos: old.todos.map((todo) => {
            if (todo.id !== todoId) return todo;
            const reordered = subTodoIds
              .map((id) => todo.subTodos.find((st) => st.id === id))
              .filter((st) => st != null);
            return { ...todo, subTodos: reordered };
          }),
        };
      });

      return { previous, startDate };
    },
    onSuccess: (_data, { todoId }) => {
      trackEvent('todo_item_reordered', { todo_id: todoId });
    },
    onError: (_err, _vars, context) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (context?.previous) {
        queryClient.setQueryData(TODO_QUERY_KEYS.listByDate(context.startDate), context.previous);
      }
      if (context) {
        queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.listByDate(context.startDate) });
      }
    },
  });
};
