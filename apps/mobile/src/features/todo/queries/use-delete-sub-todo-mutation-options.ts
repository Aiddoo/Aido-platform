import { useSubTodoService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys';
import { SubTodoPolicy } from '../domains/sub-todo.model';
import type { TodoListResult } from '../domains/todo.model';

interface DeleteSubTodoParams {
  todoId: number;
  subTodoId: number;
  startDate: string;
}

export const useDeleteSubTodoMutationOptions = () => {
  const subTodoService = useSubTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ todoId, subTodoId }: DeleteSubTodoParams) => {
      const result = await subTodoService.deleteSubTodo(todoId, subTodoId);
      return unwrap(result);
    },
    onMutate: async ({ todoId, subTodoId, startDate }) => {
      await queryClient.cancelQueries({
        queryKey: TODO_QUERY_KEYS.listByDate({ date: startDate }),
      });

      const previousData = queryClient.getQueryData<TodoListResult>(
        TODO_QUERY_KEYS.listByDate({ date: startDate }),
      );

      queryClient.setQueryData<TodoListResult>(
        TODO_QUERY_KEYS.listByDate({ date: startDate }),
        (old) => {
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
                subTodos: todo.subTodos.filter((subTodo) => subTodo.id !== subTodoId),
                subTodoStats: SubTodoPolicy.statsAfterDelete(todo, subTodoId),
              };
            }),
          };
        },
      );

      return { previousData, startDate };
    },
    onSuccess: (_data, { todoId, subTodoId }) => {
      trackEvent('todo_item_deleted', { todo_id: todoId, item_id: subTodoId });
    },
    onError: (_error, _variables, context) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.error(undefined, { fallback: t('todo:toast.subTodoDeleteFailed') });
      if (context) {
        queryClient.setQueryData(
          TODO_QUERY_KEYS.listByDate({ date: context.startDate }),
          context.previousData,
        );
      }
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.lists() });
    },
  });
};
