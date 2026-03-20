import type { UpdateTodoCategoryInput } from '@aido/validators';
import { useTodoCategoryService } from '@src/bootstrap/providers/di-provider';
import { isTodoCategoryError } from '@src/features/todo/models/todo-category.error';
import type { TodoCategoriesResult } from '@src/features/todo/models/todo-category.model';
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
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.list() });

      const previousData = queryClient.getQueryData<TodoCategoriesResult>(
        TODO_CATEGORY_QUERY_KEYS.list(),
      );

      queryClient.setQueryData<TodoCategoriesResult>(TODO_CATEGORY_QUERY_KEYS.list(), (old) => {
        if (!old) {
          return old;
        }
        return {
          ...old,
          categories: old.categories.map((c) => (c.id === id ? { ...c, ...input } : c)),
        };
      });

      return { previousData };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.all });
      toast.success('카테고리를 수정했어요');
      trackEvent('category_updated', {
        field: variables.input.color ? 'color' : 'name',
      });
    },
    onError: (error, _variables, context) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (context?.previousData !== undefined) {
        queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), context.previousData);
      }

      if (isTodoCategoryError(error) || isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: '잠시 후 다시 수정해 보세요' });
    },
  });
};
