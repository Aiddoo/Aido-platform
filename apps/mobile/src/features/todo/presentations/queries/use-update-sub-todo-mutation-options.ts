import { useSubTodoService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import type { TodosResult } from '../../models/todo.model';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

interface UpdateSubTodoParams {
  todoId: number;
  subTodoId: number;
  title: string;
  startDate: string;
}

export const useUpdateSubTodoMutationOptions = () => {
  const subTodoService = useSubTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ todoId, subTodoId, title }: UpdateSubTodoParams) => {
      const result = await subTodoService.updateSubTodo(todoId, subTodoId, { title });
      return unwrap(result);
    },
    onMutate: async ({ todoId, subTodoId, title, startDate }) => {
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
                subTodo.id === subTodoId ? { ...subTodo, title } : subTodo,
              ),
            };
          }),
        };
      });

      return { previousData, startDate };
    },
    onSuccess: (_data, { todoId, subTodoId }) => {
      trackEvent('todo_item_updated', { todo_id: todoId, item_id: subTodoId });
    },
    onError: (_error, _variables, context) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.error(undefined, { fallback: '항목 수정에 실패했어요' });
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
