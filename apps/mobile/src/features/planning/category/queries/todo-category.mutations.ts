import { useHaptics, useTodoCategoryService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { findLimitedFeature } from '@src/features/billing/subscription/domains/entitlement.error';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import {
  invalidateFeedTodos,
  invalidateTodos,
  invalidateWidgetSummary,
} from '@src/features/planning/todo/queries/todo-cache';
import { useTrack } from '@src/shared/analytics';
import { getUserFacingMessage } from '@src/shared/errors';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { createOptimisticId } from '@src/shared/utils/create-optimistic-id';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_CATEGORY_QUERY_KEYS } from '../constants/todo-category-query-keys';
import { TodoCategoryPolicy } from '../domains/todo-category.model';
import type { TodoCategoryFormValues } from '../schemas/todo-category-form.schema';
import type {
  OptimisticTodoCategoryWithCount,
  TodoCategoriesResult,
  TodoCategoryChange,
  TodoCategoryRemoval,
  TodoCategoryReorder,
} from '../schemas/todo-category.schema';
import { getCategoryUpdatedField } from '../utils/todo-category-analytics';
import { invalidateTodoCategories } from './todo-category-cache';

export function useCreateTodoCategoryMutationOptions() {
  const todoCategoryService = useTodoCategoryService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const haptics = useHaptics();

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

      haptics.notify('error');
      toast.error(getUserFacingMessage(error), {
        fallback: t('todo:toast.addFailedRetry'),
      });
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
  const haptics = useHaptics();

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
          categories: old.categories.map((category) =>
            category.id === id ? { ...category, ...input } : category,
          ),
        };
      });

      return { previousData };
    },
    onSuccess: (_data, variables, context) => {
      invalidateTodoCategories(queryClient);
      invalidateFeedTodos(queryClient);
      toast.success(t('todo:toast.categoryUpdated'));
      const previous = TodoCategoryPolicy.findCategory(
        context?.previousData?.categories ?? [],
        variables.id,
      );
      trackEvent('category_updated', {
        field: getCategoryUpdatedField(previous, variables.input),
      });
    },
    onError: (error, _variables, context) => {
      if (context?.previousData != null) {
        queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), context.previousData);
      }

      haptics.notify('error');
      toast.error(getUserFacingMessage(error), {
        fallback: t('todo:toast.updateFailedRetry'),
      });
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
  const haptics = useHaptics();

  return mutationOptions({
    // 오프라인에 멈춰 두면 삭제 중 표시가 끝나지 않는다. 바로 실패해 안내하고 낙관 삭제를 되돌린다
    networkMode: 'always',
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
          categories: old.categories.filter((category) => category.id !== id),
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

      haptics.notify('error');
      toast.error(getUserFacingMessage(error), {
        fallback: t('todo:toast.deleteFailedRetry'),
      });
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
  const toast = useAppToast();

  return mutationOptions({
    // 저장하는 동안 목록이 끌기 전 순서를 붙잡는다. 오프라인에 멈춰 두면 연결될 때까지 묶이니 바로 실패해 제자리로 돌리고 알린다
    networkMode: 'always',
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
    onError: (error) => {
      invalidateTodoCategories(queryClient);
      haptics.notify('error');
      toast.error(getUserFacingMessage(error), { fallback: t('todo:toast.changeFailedRetry') });
    },
  });
}
