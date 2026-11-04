import { TODO_SERIES_LIMITS } from '@aido/api/vocabulary';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { useQueryClient } from '@tanstack/react-query';

import { getTodoSeriesFailure, shouldRefreshTodos } from '../domains/todo-series.error';
import { invalidateTodos } from './todo-cache';

/** 반복 할 일 오류(TODO_0841~0846)를 다음 행동과 함께 알린다. 처리했으면 true. 입력값은 건드리지 않는다 */
export function useTodoSeriesFailureHandler() {
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return (error: unknown): boolean => {
    const failure = getTodoSeriesFailure(error);
    if (failure == null) {
      return false;
    }
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
