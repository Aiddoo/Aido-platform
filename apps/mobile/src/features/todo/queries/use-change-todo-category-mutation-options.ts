import type { ChangeTodoCategoryInput } from '@aido/api';
import { useTodoCategoryService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { notifyError } from '@src/shared/utils/haptics';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { invalidateTodos } from './todo-cache';

interface ChangeTodoCategoryMutationParams {
  todoId: number;
  input: ChangeTodoCategoryInput;
}

export const useChangeTodoCategoryMutationOptions = () => {
  const todoCategoryService = useTodoCategoryService();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const { trackEvent } = useTrack();

  return mutationOptions({
    mutationFn: async ({ todoId, input }: ChangeTodoCategoryMutationParams) => {
      const result = await todoCategoryService.changeTodoCategory(todoId, input);
      return unwrap(result);
    },
    onSuccess: (_data, variables) => {
      invalidateTodos(queryClient);
      toast.success(t('todo:toast.categoryChanged'));
      trackEvent('todo_edited', { todo_id: variables.todoId, field: 'categoryId' });
    },
    onError: (error) => {
      notifyError();

      if (isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: t('todo:toast.changeFailedRetry') });
    },
  });
};
