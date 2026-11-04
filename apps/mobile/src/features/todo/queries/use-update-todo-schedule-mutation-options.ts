import type { UpdateTodoScheduleInput } from '@aido/api';
import { useHaptics, useTodoService } from '@src/bootstrap/providers/di-context';
import { invalidateNudgeInteractions } from '@src/features/nudge/queries/nudge-cache';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { invalidateTodos } from './todo-cache';

export interface UpdateTodoScheduleMutationParams {
  todoId: number;
  input: UpdateTodoScheduleInput;
}

export const useUpdateTodoScheduleMutationOptions = () => {
  const haptics = useHaptics();
  const todoService = useTodoService();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ todoId, input }: UpdateTodoScheduleMutationParams) => {
      const result = await todoService.updateTodoSchedule(todoId, input);
      return unwrap(result);
    },
    onSuccess: () => {
      invalidateTodos(queryClient);
      invalidateNudgeInteractions(queryClient);
      toast.success(t('todo:toast.scheduleChanged'));
    },
    onError: (error) => {
      haptics.notify('error');

      if (isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: t('todo:toast.updateFailedRetry') });
    },
  });
};
