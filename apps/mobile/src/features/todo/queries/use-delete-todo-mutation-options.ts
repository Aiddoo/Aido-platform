import { useHaptics, useTodoService } from '@src/bootstrap/providers/di-context';
import { invalidateNudgeInteractions } from '@src/features/nudge/queries/nudge-cache';
import { TODO_CATEGORY_QUERY_KEYS } from '@src/features/todo/constants/todo-category-query-keys';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys';
import type { TodoEditScope } from '../domains/todo-repeat.model';
import { isTodoSeriesUnavailableError } from '../domains/todo-series.error';
import {
  cancelTodoListQuery,
  invalidateTodos,
  removeTodoFromList,
  restoreTodo,
  snapshotTodo,
} from './todo-cache';

interface DeleteTodoMutationParams {
  todoId: number;
  startDate: string;
  scope?: TodoEditScope;
}

export const useDeleteTodoMutationOptions = () => {
  const haptics = useHaptics();
  const todoService = useTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ todoId, scope }: DeleteTodoMutationParams) => {
      const result = await todoService.deleteTodo(todoId, scope);
      return unwrap(result);
    },
    onMutate: async ({ todoId, startDate }) => {
      await cancelTodoListQuery(queryClient, { date: startDate });
      const snapshot = snapshotTodo(queryClient, { date: startDate, todoId });
      removeTodoFromList(queryClient, { date: startDate, todoId });

      return { snapshot };
    },
    onSuccess: (_, { todoId, scope }) => {
      toast.success(t('todo:toast.todoDeleted'));
      trackEvent('todo_deleted', { todo_id: todoId });
      if (scope != null) {
        trackEvent('todo_series_deleted', { scope });
        invalidateTodos(queryClient);
      }
    },
    onError: (error, _variables, context) => {
      haptics.notify('error');

      if (context?.snapshot) {
        restoreTodo(queryClient, context.snapshot);
      }

      if (isTodoSeriesUnavailableError(error)) {
        toast.error(t('todo:toast.repeatUnavailable'));
        return;
      }

      if (isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: t('todo:toast.deleteFailedRetry') });
    },
    onSettled: (_data, _error, { startDate }) => {
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.listByDate({ date: startDate }) });
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.completions() });
      queryClient.invalidateQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.all });
      invalidateNudgeInteractions(queryClient);
    },
  });
};
