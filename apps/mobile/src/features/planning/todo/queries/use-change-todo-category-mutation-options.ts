import type { ChangeTodoCategoryInput } from '@aido/api';
import { useHaptics, useTodoService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import type { TodoUpdateScope } from '../domains/todo-repeat.model';
import { invalidateTodos } from './todo-cache';
import { useTodoSeriesFailureHandler } from './use-todo-series-failure-handler';

interface ChangeTodoCategoryMutationParams {
  todoId: number;
  input: ChangeTodoCategoryInput;
  scope?: TodoUpdateScope;
}

export const useChangeTodoCategoryMutationOptions = () => {
  const haptics = useHaptics();
  const todoService = useTodoService();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const handleSeriesFailure = useTodoSeriesFailureHandler();
  const { trackEvent } = useTrack();

  return mutationOptions({
    mutationFn: async ({ todoId, input, scope }: ChangeTodoCategoryMutationParams) => {
      const result = await todoService.changeTodoCategory(todoId, input, scope);
      return unwrap(result);
    },
    onSuccess: (_data, variables) => {
      invalidateTodos(queryClient);
      toast.success(t('todo:toast.categoryChanged'));
      trackEvent('todo_edited', { todo_id: variables.todoId, field: 'categoryId' });
      if (variables.scope != null) {
        trackEvent('todo_series_edited', { scope: variables.scope });
      }
    },
    onError: (error) => {
      haptics.notify('error');

      if (handleSeriesFailure(error)) {
        return;
      }

      if (isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: t('todo:toast.changeFailedRetry') });
    },
  });
};
