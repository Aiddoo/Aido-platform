import { useHaptics, useTodoCategoryService } from '@src/bootstrap/providers/di-context';
import { findLimitedFeature } from '@src/features/billing/subscription/apis/entitlement.mapper';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import {
  createOptimisticId,
  invalidateFeedTodos,
  invalidateTodos,
  invalidateWidgetSummary,
} from '@src/features/planning/todo/queries/todo-cache';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useMutationFailure } from '@src/shared/hooks/use-mutation-failure';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_CATEGORY_QUERY_KEYS } from '../constants/todo-category-query-keys';
import type { TodoCategoryFormValues } from '../schemas/todo-category-form.schema';
import type {
  OptimisticTodoCategoryWithCount,
  TodoCategoriesResult,
  TodoCategoryChange,
  TodoCategoryRemoval,
  TodoCategoryReorder,
} from '../schemas/todo-category.schema';
import { invalidateTodoCategories } from './todo-category-cache';

export function useCreateTodoCategoryMutationOptions() {
  const todoCategoryService = useTodoCategoryService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const showFailure = useMutationFailure(t('todo:toast.addFailedRetry'));

  return mutationOptions({
    // 연결이 없을 때 요청을 쥐고 기다리면 저장 시트가 스피너만 돈다. 바로 실패해 입력값을 지킨다
    networkMode: 'always',
    mutationFn: async (input: TodoCategoryFormValues) =>
      unwrap(await todoCategoryService.createCategory(input)),
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
      if (context?.previousData != null) {
        queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), context.previousData);
      }

      // 카테고리 한도는 시트의 한도 게이트가 PremiumDialog로 안내한다
      if (findLimitedFeature(error) != null) {
        return;
      }

      showFailure(error);
    },
  });
}

interface UpdateTodoCategoryParams {
  id: number;
  input: TodoCategoryChange;
}

export function useUpdateTodoCategoryMutationOptions() {
  const todoCategoryService = useTodoCategoryService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const showFailure = useMutationFailure(t('todo:toast.updateFailedRetry'));

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async ({ id, input }: UpdateTodoCategoryParams) =>
      unwrap(await todoCategoryService.updateCategory(id, input)),
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
      invalidateTodoCategories(queryClient);
      invalidateFeedTodos(queryClient);
      toast.success(t('todo:toast.categoryUpdated'));
      trackEvent('category_updated', {
        field: variables.input.color ? 'color' : 'name',
      });
    },
    onError: (error, _variables, context) => {
      if (context?.previousData != null) {
        queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), context.previousData);
      }

      showFailure(error);
    },
  });
}

interface DeleteTodoCategoryParams {
  id: number;
  query?: TodoCategoryRemoval;
}

export function useDeleteTodoCategoryMutationOptions() {
  const todoCategoryService = useTodoCategoryService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const showFailure = useMutationFailure(t('todo:toast.deleteFailedRetry'));

  return mutationOptions({
    mutationFn: async ({ id, query }: DeleteTodoCategoryParams) =>
      unwrap(await todoCategoryService.deleteCategory(id, query)),
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
      toast.success(t('todo:toast.categoryDeleted'));
    },
    onError: (error, _variables, context) => {
      if (context?.previousData != null) {
        queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), context.previousData);
      }

      showFailure(error);
    },
  });
}

interface ReorderTodoCategoryParams {
  id: number;
  input: TodoCategoryReorder;
}

export function useReorderTodoCategoryMutationOptions() {
  const haptics = useHaptics();
  const todoCategoryService = useTodoCategoryService();
  const queryClient = useQueryClient();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();

  return mutationOptions({
    mutationFn: async ({ id, input }: ReorderTodoCategoryParams) =>
      unwrap(await todoCategoryService.reorderCategory(id, input)),
    onSuccess: () => {
      invalidateTodoCategories(queryClient);
      invalidateWidgetSummary(queryClient);
      trackEvent('category_reordered', { source: 'settings' });
      const accountId = getCachedMe(queryClient)?.id;
      if (accountId) {
        trackAttributedFeatureSuccess({ accountId, feature: 'category_reorder' });
      }
    },
    onError: () => {
      haptics.notify('error');
      invalidateTodoCategories(queryClient);
    },
  });
}
