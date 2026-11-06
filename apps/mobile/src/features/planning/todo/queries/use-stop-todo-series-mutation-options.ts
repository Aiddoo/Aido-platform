import { useHaptics, useTodoService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { invalidateTodos } from './todo-cache';
import { useTodoSeriesFailureHandler } from './use-todo-series-failure-handler';

interface StopTodoSeriesMutationParams {
  todoId: number;
}

export const useStopTodoSeriesMutationOptions = () => {
  const haptics = useHaptics();
  const todoService = useTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const handleSeriesFailure = useTodoSeriesFailureHandler();

  return mutationOptions({
    mutationFn: async ({ todoId }: StopTodoSeriesMutationParams) =>
      unwrap(await todoService.stopTodoSeries(todoId)),
    onSuccess: () => {
      invalidateTodos(queryClient);
      toast.success(t('todo:toast.seriesStopped'));
      trackEvent('todo_series_stopped');
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
