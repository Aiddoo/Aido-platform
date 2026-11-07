import { TODO_SERIES_LIMITS } from '@aido/api/vocabulary';
import { useHaptics, useTodoService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { useTrack } from '@src/shared/analytics';
import { useMutationFailure } from '@src/shared/hooks/use-mutation-failure';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { getTodoSeriesFailure, shouldRefreshTodos } from '../domains/todo-series.error';
import { invalidateTodos } from './todo-cache';

interface StopTodoSeriesMutationParams {
  todoId: number;
}

export function useStopTodoSeriesMutationOptions() {
  const todoService = useTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const showFailure = useMutationFailure(t('todo:toast.updateFailedRetry'));
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
      if (handleSeriesFailure(error)) {
        return;
      }

      showFailure(error);
    },
  });
}

/** 반복 할 일 오류(TODO_0841~0846)를 다음 행동과 함께 알린다. 처리했으면 true. 입력값은 건드리지 않는다 */
export function useTodoSeriesFailureHandler() {
  const haptics = useHaptics();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return (error: unknown): boolean => {
    const failure = getTodoSeriesFailure(error);
    if (failure == null) {
      return false;
    }
    haptics.notify('error');
    if (shouldRefreshTodos(failure)) {
      invalidateTodos(queryClient);
    }
    toast.error(
      t(`todo:toast.series.${failure}.title`, { limit: TODO_SERIES_LIMITS.MAX_ACTIVE_PER_USER }),
      { description: t(`todo:toast.series.${failure}.description`) },
    );
    return true;
  };
}
