import { useTodoApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { useTrack } from '@src/shared/analytics';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { isTodoSeriesFailure } from '../domains/todo-series.error';
import { useTodoSeriesFailureFeedback } from '../hooks/use-todo-series-failure-feedback';
import { invalidateTodos } from './todo-cache';

interface StopTodoSeriesVariables {
  todoId: number;
}

export function useStopTodoSeriesMutationOptions() {
  const todoApi = useTodoApi();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const showTodoSeriesFailure = useTodoSeriesFailureFeedback();
  const toast = useAppToast();

  return mutationOptions({
    // 오프라인에 멈춰 두면 반복 끝내기가 끝나지 않는다. 바로 실패해 안내한다
    networkMode: 'always',
    mutationFn: async ({ todoId }: StopTodoSeriesVariables) =>
      unwrap(await todoApi.stopTodoSeries(todoId)),
    onSuccess: () => {
      toast.success(t('todo:toast.seriesStopped'));
      trackEvent('todo_series_stopped');
    },
    onError: (error) => {
      showTodoSeriesFailure(error);
    },
    // 끝낸 반복의 남은 회차가 어느 날짜에서 빠졌는지 몰라 넓게 맞춘다
    onSettled: (_data, error) => {
      if (error == null) {
        invalidateTodos(queryClient);
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
