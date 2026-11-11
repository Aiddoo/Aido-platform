import { useHaptics, useTodoService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { useTrack } from '@src/shared/analytics';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import {
  findTodoSeriesFailure,
  getTodoSeriesLimit,
  isTodoSeriesFailure,
  shouldRefreshTodos,
} from '../domains/todo-series.error';
import { invalidateTodos } from './todo-cache';

interface StopTodoSeriesVariables {
  todoId: number;
}

export function useStopTodoSeriesMutationOptions() {
  const todoService = useTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const haptics = useHaptics();

  return mutationOptions({
    // 오프라인에 멈춰 두면 반복 끝내기가 끝나지 않는다. 바로 실패해 안내한다
    networkMode: 'always',
    mutationFn: async ({ todoId }: StopTodoSeriesVariables) =>
      unwrap(await todoService.stopTodoSeries(todoId)),
    onSuccess: () => {
      invalidateTodos(queryClient);
      toast.success(t('todo:toast.seriesStopped'));
      trackEvent('todo_series_stopped');
    },
    onError: (error) => {
      const seriesFailure = findTodoSeriesFailure(error);
      if (seriesFailure != null) {
        haptics.notify('error');
        if (shouldRefreshTodos(seriesFailure)) {
          invalidateTodos(queryClient);
        }
        toast.error(
          t(`todo:toast.series.${seriesFailure}.title`, {
            limit: getTodoSeriesLimit(error),
          }),
          { description: t(`todo:toast.series.${seriesFailure}.description`) },
        );
      }
    },
    meta: {
      errorFeedback: {
        feature: 'todo',
        fallbackKey: 'todo:toast.updateFailedRetry',
        isHandledByFeature: isTodoSeriesFailure,
      },
    },
  });
}
