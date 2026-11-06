import type { DeleteTodoCategoryQuery } from '@aido/api';
import { useHaptics, useTodoCategoryService } from '@src/bootstrap/providers/di-context';
import type { TodoCategoriesResult } from '@src/features/planning/category/domains/todo-category.model';
import { invalidateTodos } from '@src/features/planning/todo/queries/todo-cache';
import { invalidateNudgeInteractions } from '@src/features/social/nudge/queries/nudge-cache';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_CATEGORY_QUERY_KEYS } from '../constants/todo-category-query-keys';

interface DeleteTodoCategoryParams {
  id: number;
  query?: DeleteTodoCategoryQuery;
}

export const useDeleteTodoCategoryMutationOptions = () => {
  const haptics = useHaptics();
  const todoCategoryService = useTodoCategoryService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ id, query }: DeleteTodoCategoryParams) => {
      const result = await todoCategoryService.deleteCategory(id, query);
      return unwrap(result);
    },
    onMutate: async ({ id }) => {
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
          categories: old.categories.filter((c) => c.id !== id),
        };
      });

      return { previousData };
    },
    onSuccess: () => {
      trackEvent('category_deleted');
      invalidateTodos(queryClient);
      invalidateNudgeInteractions(queryClient);
      toast.success(t('todo:toast.categoryDeleted'));
    },
    onError: (error, _variables, context) => {
      haptics.notify('error');

      if (context?.previousData != null) {
        queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), context.previousData);
      }

      if (isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: t('todo:toast.deleteFailedRetry') });
    },
  });
};
