import type {
  CreateTodoCategoryInput,
  DeleteTodoCategoryQuery,
  ReorderTodoCategoryInput,
  UpdateTodoCategoryInput,
} from '@aido/api';
import { useHaptics, useTodoCategoryService } from '@src/bootstrap/providers/di-context';
import { findLimitedFeature } from '@src/features/billing/subscription/apis/entitlement.mapper';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import type {
  OptimisticTodoCategoryWithCount,
  TodoCategoriesResult,
} from '@src/features/planning/category/schemas/todo-category.schema';
import { TODO_QUERY_KEYS } from '@src/features/planning/todo/constants/todo-query-keys';
import {
  createOptimisticId,
  invalidateTodos,
  invalidateWidgetSummary,
} from '@src/features/planning/todo/queries/todo-cache';
import { invalidateNudgeInteractions } from '@src/features/social/nudge/queries/nudge-cache';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_CATEGORY_QUERY_KEYS } from '../constants/todo-category-query-keys';

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

interface ReorderTodoCategoryParams {
  id: number;
  input: ReorderTodoCategoryInput;
}

export const useReorderTodoCategoryMutationOptions = () => {
  const haptics = useHaptics();
  const todoCategoryService = useTodoCategoryService();
  const queryClient = useQueryClient();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();

  return mutationOptions({
    mutationFn: async ({ id, input }: ReorderTodoCategoryParams) => {
      const result = await todoCategoryService.reorderCategory(id, input);
      return unwrap(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.list() });
      invalidateWidgetSummary(queryClient);
      trackEvent('category_reordered', { source: 'settings' });
      const accountId = getCachedMe(queryClient)?.id;
      if (accountId) {
        trackAttributedFeatureSuccess({ accountId, feature: 'category_reorder' });
      }
    },
    onError: () => {
      haptics.notify('error');
      queryClient.invalidateQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.list() });
    },
  });
};

interface UpdateTodoCategoryParams {
  id: number;
  input: UpdateTodoCategoryInput;
}

export const useUpdateTodoCategoryMutationOptions = () => {
  const haptics = useHaptics();
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
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.completions() });
      toast.success(t('todo:toast.categoryUpdated'));
      trackEvent('category_updated', {
        field: variables.input.color ? 'color' : 'name',
      });
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
      toast.error(undefined, { fallback: t('todo:toast.updateFailedRetry') });
    },
  });
};
