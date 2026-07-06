import { useTodoService } from '@src/bootstrap/providers/di-context';
import { TODO_CATEGORY_QUERY_KEYS } from '@src/features/todo/presentations/constants/todo-category-query-keys.constant';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { isTodoError } from '../../models/todo.error';
import type { TodosResult } from '../../models/todo.model';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

interface DeleteTodoMutationParams {
  todoId: number;
  startDate: string;
}

export const useDeleteTodoMutationOptions = () => {
  const todoService = useTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ todoId }: DeleteTodoMutationParams) => {
      const result = await todoService.deleteTodo(todoId);
      return unwrap(result);
    },
    onMutate: async ({ todoId, startDate }) => {
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
          todos: old.todos.filter((todo) => todo.id !== todoId),
        };
      });

      return { previousData, startDate };
    },
    onSuccess: (_, { todoId }) => {
      toast.success(t('todo:toast.todoDeleted'));
      trackEvent('todo_deleted', { todo_id: todoId });
    },
    onError: (error, _variables, context) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (context?.previousData !== undefined) {
        queryClient.setQueryData(
          TODO_QUERY_KEYS.listByDate(context.startDate),
          context.previousData,
        );
      }

      if (isTodoError(error) || isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: t('todo:toast.deleteFailedRetry') });
    },
    onSettled: (_data, _error, { startDate }) => {
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.listByDate(startDate) });
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.completions() });
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.ranges() });
      queryClient.invalidateQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.all });
    },
  });
};
