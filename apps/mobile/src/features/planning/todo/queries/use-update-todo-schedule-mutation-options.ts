import type { UpdateTodoScheduleInput } from '@aido/api';
import { useHaptics, useTodoService } from '@src/bootstrap/providers/di-context';
import { invalidateNudgeInteractions } from '@src/features/social/nudge/queries/nudge-cache';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import type { TodoUpdateScope } from '../domains/todo-repeat.model';
import { invalidateTodos } from './todo-cache';
import { useTodoSeriesFailureHandler } from './use-todo-series-failure-handler';

export interface UpdateTodoScheduleMutationParams {
  todoId: number;
  input: UpdateTodoScheduleInput;
  /** 사용자가 고친 칸. 저장 안내 문구를 고른다. 안내를 따로 띄우는 곳(날씨 일괄 옮기기)은 넘기지 않는다 */
  changedField?: 'date' | 'time';
  scope?: TodoUpdateScope;
}

export const useUpdateTodoScheduleMutationOptions = () => {
  const haptics = useHaptics();
  const todoService = useTodoService();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const handleSeriesFailure = useTodoSeriesFailureHandler();
  const { trackEvent } = useTrack();

  return mutationOptions({
    mutationFn: async ({ todoId, input, scope }: UpdateTodoScheduleMutationParams) => {
      const result = await todoService.updateTodoSchedule(todoId, input, scope);
      return unwrap(result);
    },
    onSuccess: (_data, { changedField, scope }) => {
      invalidateTodos(queryClient);
      invalidateNudgeInteractions(queryClient);
      toast.success(
        changedField === 'time' ? t('todo:toast.timeChanged') : t('todo:toast.dateChanged'),
      );
      if (scope != null) {
        trackEvent('todo_series_edited', { scope });
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
