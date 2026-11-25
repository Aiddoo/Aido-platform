import { useHaptics, useTodoApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { useTrack } from '@src/shared/analytics';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import {
  findTodoSeriesFailure,
  findTodoSeriesLimit,
  isTodoSeriesFailure,
  shouldRefreshTodos,
} from '../domains/todo-series.error';
import { invalidateTodos, settleTodoSeriesWrite } from './todo-cache';
import { TODO_MUTATION_KEYS } from './todo-mutation-keys';

/**
 * 반복 묶음 거절을 회차·한도별 안내로 보이고, 묶음이 바뀌었으면 할 일을 다시 맞춘다. 반복 묶음 오류가 아니면 false라
 * 부른 쪽이 다음 안내로 넘어간다. 반복 묶음을 고치는 mutation의 `onError`가 부르고 `isHandledByFeature`로 전역 안내를 뺀다
 */
export function useTodoSeriesFailureFeedback() {
  const haptics = useHaptics();
  const toast = useAppToast();
  const queryClient = useQueryClient();

  return (error: unknown): boolean => {
    const failure = findTodoSeriesFailure(error);
    if (failure == null) {
      return false;
    }
    haptics.notify('error');
    if (shouldRefreshTodos(failure)) {
      invalidateTodos(queryClient);
    }
    toast.error(t(`todo:toast.series.${failure}.title`, { limit: findTodoSeriesLimit(error) }), {
      description: t(`todo:toast.series.${failure}.description`),
    });
    return true;
  };
}

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
    // 넓게 다시 받을 때 진행 중인 체크의 낙관적 값을 덮지 않게 같은 키로 센다
    mutationKey: TODO_MUTATION_KEYS.listWrites(),
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
        settleTodoSeriesWrite(queryClient);
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
