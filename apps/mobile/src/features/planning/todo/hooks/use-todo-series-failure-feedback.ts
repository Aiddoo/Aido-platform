import { useHaptics } from '@src/bootstrap/providers/di-context';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { useQueryClient } from '@tanstack/react-query';

import {
  findTodoSeriesFailure,
  getTodoSeriesLimit,
  shouldRefreshTodos,
} from '../domains/todo-series.error';
import { invalidateTodos } from '../queries/todo-cache';

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
    toast.error(t(`todo:toast.series.${failure}.title`, { limit: getTodoSeriesLimit(error) }), {
      description: t(`todo:toast.series.${failure}.description`),
    });
    return true;
  };
}
