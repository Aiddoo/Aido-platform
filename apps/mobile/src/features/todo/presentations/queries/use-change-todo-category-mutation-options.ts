import type { ChangeTodoCategoryInput } from '@aido/validators';
import { useTodoCategoryService } from '@src/bootstrap/providers/di-provider';
import { TODO_CATEGORY_QUERY_KEYS } from '@src/features/todo/presentations/constants/todo-category-query-keys.constant';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { isTodoError } from '../../models/todo.error';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

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
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.all });
      toast.success('카테고리를 변경했어요');
      trackEvent('todo_edited', { todo_id: variables.todoId, field: 'categoryId' });
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isTodoError(error) || isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: '잠시 후 다시 변경해 보세요' });
    },
  });
};
