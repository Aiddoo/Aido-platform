import { useHaptics, useTodoService } from '@src/bootstrap/providers/di-context';
import { invalidateTodoCategories } from '@src/features/planning/category/queries/todo-category-cache';
import { invalidateNudgeInteractions } from '@src/features/social/nudge/queries/nudge-cache';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_MUTATION_KEYS } from '../constants/todo-mutation-keys';
import type { TodoEditScope } from '../domains/todo-repeat.model';
import {
  cancelTodoCompletionQueries,
  invalidateTodos,
  removeTodoFromList,
  restoreTodo,
  settleTodoCompletionWrite,
  snapshotTodo,
  syncDailyCompletionWithList,
} from './todo-cache';
import { useTodoSeriesFailureHandler } from './use-todo-series-failure-handler';

interface DeleteTodoMutationParams {
  todoId: number;
  /** 지운 목록의 날짜. 여러 날 할 일은 시작일이 아니라 보고 있는 날짜 목록을 고친다 */
  date: string;
  scope?: TodoEditScope;
}

export const useDeleteTodoMutationOptions = () => {
  const haptics = useHaptics();
  const todoService = useTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const handleSeriesFailure = useTodoSeriesFailureHandler();

  return mutationOptions({
    mutationKey: TODO_MUTATION_KEYS.completionWrites(),
    mutationFn: async ({ todoId, scope }: DeleteTodoMutationParams) => {
      const result = await todoService.deleteTodo(todoId, scope);
      return unwrap(result);
    },
    onMutate: async ({ todoId, date }) => {
      await cancelTodoCompletionQueries(queryClient, { date, todoId });
      const snapshot = snapshotTodo(queryClient, { date, todoId });
      removeTodoFromList(queryClient, { date, todoId });
      syncDailyCompletionWithList(queryClient, { date });

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
        syncDailyCompletionWithList(queryClient, { date: context.snapshot.date });
      }

      if (handleSeriesFailure(error)) {
        return;
      }

      if (isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: t('todo:toast.deleteFailedRetry') });
    },
    onSettled: () => {
      invalidateTodoCategories(queryClient);
      invalidateNudgeInteractions(queryClient);
      settleTodoCompletionWrite(queryClient);
    },
  });
};
