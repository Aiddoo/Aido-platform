import type { UpdateTodoInput } from '@aido/api';
import { useTodoService } from '@src/bootstrap/providers/di-context';
import { invalidateNudgeInteractions } from '@src/features/nudge/queries/nudge-cache';
import { TODO_CATEGORY_QUERY_KEYS } from '@src/features/todo/constants/todo-category-query-keys';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys';

interface UpdateTodoMutationParams {
  todoId: number;
  input: UpdateTodoInput;
}

export const useUpdateTodoMutationOptions = () => {
  const todoService = useTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ todoId, input }: UpdateTodoMutationParams) => {
      const result = await todoService.updateTodo(todoId, input);
      return unwrap(result);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.all });
      invalidateNudgeInteractions(queryClient);
      queryClient.invalidateQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.all });
      toast.success(t('todo:toast.todoUpdated'));
      const field = Object.keys(variables.input).join(',');
      trackEvent('todo_edited', { todo_id: variables.todoId, field });
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: t('todo:toast.updateFailedRetry') });
    },
  });
};
