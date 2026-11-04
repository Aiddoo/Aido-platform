import type { UpdateTodoScheduleInput } from '@aido/api';
import { useHaptics, useTodoService } from '@src/bootstrap/providers/di-context';
import { invalidateNudgeInteractions } from '@src/features/nudge/queries/nudge-cache';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import type { TodoEditScope } from '../domains/todo-repeat.model';
import { isTodoSeriesUnavailableError } from '../domains/todo-series.error';
import { invalidateTodos } from './todo-cache';

export interface UpdateTodoScheduleMutationParams {
  todoId: number;
  input: UpdateTodoScheduleInput;
  scope?: TodoEditScope;
}

export const useUpdateTodoScheduleMutationOptions = () => {
  const haptics = useHaptics();
  const todoService = useTodoService();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const { trackEvent } = useTrack();

  return mutationOptions({
    mutationFn: async ({ todoId, input, scope }: UpdateTodoScheduleMutationParams) => {
      const result = await todoService.updateTodoSchedule(todoId, input, scope);
      return unwrap(result);
    },
    onSuccess: (_data, { scope }) => {
      invalidateTodos(queryClient);
      invalidateNudgeInteractions(queryClient);
      toast.success(t('todo:toast.scheduleChanged'));
      if (scope != null) {
        trackEvent('todo_series_edited', { scope });
      }
    },
    onError: (error) => {
      haptics.notify('error');

      if (isTodoSeriesUnavailableError(error)) {
        toast.error(t('todo:toast.repeatUnavailable'));
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
