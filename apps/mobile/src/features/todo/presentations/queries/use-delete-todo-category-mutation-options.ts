import type { DeleteTodoCategoryQuery } from '@aido/validators';
import { useTodoCategoryService } from '@src/bootstrap/providers/di-provider';
import { isTodoCategoryError } from '@src/features/todo/models/todo-category.error';
import { TODO_QUERY_KEYS } from '@src/features/todo/presentations/constants/todo-query-keys.constant';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { TODO_CATEGORY_QUERY_KEYS } from '../constants/todo-category-query-keys.constant';

interface DeleteTodoCategoryParams {
  id: number;
  query?: DeleteTodoCategoryQuery;
}

export const useDeleteTodoCategoryMutationOptions = () => {
  const todoCategoryService = useTodoCategoryService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ id, query }: DeleteTodoCategoryParams) => {
      const result = await todoCategoryService.deleteCategory(id, query);
      return unwrap(result);
    },
    onSuccess: () => {
      trackEvent('category_deleted');
      queryClient.invalidateQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.all });
      toast.success('카테고리를 삭제했어요');
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isTodoCategoryError(error) || isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: '잠시 후 다시 삭제해 보세요' });
    },
  });
};
