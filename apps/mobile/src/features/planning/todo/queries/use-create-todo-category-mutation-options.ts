import type { CreateTodoCategoryInput } from '@aido/api';
import { useHaptics, useTodoCategoryService } from '@src/bootstrap/providers/di-context';
import { findLimitedFeature } from '@src/features/billing/subscription/apis/entitlement.mapper';
import type {
  OptimisticTodoCategoryWithCount,
  TodoCategoriesResult,
} from '@src/features/planning/todo/domains/todo-category.model';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_CATEGORY_QUERY_KEYS } from '../constants/todo-category-query-keys';
import { createOptimisticId, invalidateTodos } from './todo-cache';

export const useCreateTodoCategoryMutationOptions = () => {
  const haptics = useHaptics();
  const todoCategoryService = useTodoCategoryService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (input: CreateTodoCategoryInput) => {
      const result = await todoCategoryService.createCategory(input);
      return unwrap(result);
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.list() });

      const previousData = queryClient.getQueryData<TodoCategoriesResult>(
        TODO_CATEGORY_QUERY_KEYS.list(),
      );

      const lastSortOrder = previousData?.categories.at(-1)?.sortOrder ?? 0;

      const optimisticCategory: OptimisticTodoCategoryWithCount = {
        id: createOptimisticId(),
        name: input.name,
        color: input.color,
        sortOrder: lastSortOrder + 1,
        todoCount: 0,
        optimistic: true,
      };

      queryClient.setQueryData<TodoCategoriesResult>(TODO_CATEGORY_QUERY_KEYS.list(), (old) => {
        if (!old) {
          return old;
        }
        return { ...old, categories: [...old.categories, optimisticCategory] };
      });

      return { previousData };
    },
    onSuccess: (_data, variables) => {
      invalidateTodos(queryClient);
      toast.success(t('todo:toast.categoryAdded'));
      trackEvent('category_created', { color: variables.color });
    },
    onError: (error, _variables, context) => {
      haptics.notify('error');

      if (context?.previousData != null) {
        queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), context.previousData);
      }

      // 카테고리 한도는 시트의 한도 게이트가 PremiumDialog로 안내한다
      if (findLimitedFeature(error) != null) {
        return;
      }

      if (isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: t('todo:toast.addFailedRetry') });
    },
  });
};
