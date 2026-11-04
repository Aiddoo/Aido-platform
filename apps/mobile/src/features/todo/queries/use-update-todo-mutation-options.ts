import type { UpdateTodoInput } from '@aido/api';
import { useHaptics, useTodoService } from '@src/bootstrap/providers/di-context';
import { invalidateNudgeInteractions } from '@src/features/nudge/queries/nudge-cache';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import type { TodoSeriesEditOptions } from '../apis/todo-series.mapper';
import { invalidateTodos } from './todo-cache';
import { useTodoSeriesFailureHandler } from './use-todo-series-failure-handler';

interface UpdateTodoMutationParams {
  todoId: number;
  input: UpdateTodoInput;
  options?: TodoSeriesEditOptions;
}

export const useUpdateTodoMutationOptions = () => {
  const haptics = useHaptics();
  const todoService = useTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const handleSeriesFailure = useTodoSeriesFailureHandler();

  return mutationOptions({
    mutationFn: async ({ todoId, input, options }: UpdateTodoMutationParams) => {
      const result = await todoService.updateTodo(todoId, input, options);
      return unwrap(result);
    },
    onSuccess: (_data, variables) => {
      invalidateTodos(queryClient);
      invalidateNudgeInteractions(queryClient);
      toast.success(t('todo:toast.todoUpdated'));
      const field = Object.keys(variables.input).join(',');
      trackEvent('todo_edited', { todo_id: variables.todoId, field });
      if (variables.options?.scope != null) {
        trackEvent('todo_series_edited', { scope: variables.options.scope });
      }
      // nullish-strict: repeat null만 반복 끝내기다
      if (variables.options?.repeat === null) {
        trackEvent('todo_series_stopped');
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
      toast.error(undefined, { fallback: t('todo:toast.updateFailedRetry') });
    },
  });
};
