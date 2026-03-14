import type { UpdateTodoCategoryInput } from '@aido/validators';
import { useTodoCategoryService } from '@src/bootstrap/providers/di-provider';
import { isTodoCategoryError } from '@src/features/todo/models/todo-category.error';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { TODO_CATEGORY_QUERY_KEYS } from '../constants/todo-category-query-keys.constant';

interface UpdateTodoCategoryParams {
  id: number;
  input: UpdateTodoCategoryInput;
}

export const useUpdateTodoCategoryMutationOptions = () => {
  const todoCategoryService = useTodoCategoryService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ id, input }: UpdateTodoCategoryParams) => {
      const result = await todoCategoryService.updateCategory(id, input);
      return unwrap(result);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.all });
      toast.success('카테고리를 수정했어요');
      trackEvent('category_updated', {
        field: variables.input.color ? 'color' : 'name',
      });
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isTodoCategoryError(error) || isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: '잠시 후 다시 수정해 보세요' });
    },
  });
};
