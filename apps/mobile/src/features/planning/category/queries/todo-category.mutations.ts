import { useHaptics, useTodoCategoryService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { findLimitedFeature } from '@src/features/billing/subscription/domains/entitlement.error';
import { invalidateEntitlements } from '@src/features/billing/subscription/queries/entitlement-cache';
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
import type { OptimisticTodoCategoryWithCount } from '../domains/todo-category.model';
import type { TodoCategoryFormValues } from '../schemas/todo-category-form.schema';
import type {
  TodoCategoryChange,
  TodoCategoryRemoval,
  TodoCategoryReorder,
} from '../schemas/todo-category-request.schema';
import { getCategoryUpdatedField } from '../utils/todo-category-analytics';
import {
  invalidateTodoCategories,
  withCategoryAdded,
  withCategoryChanged,
  withCategoryRemoved,
} from './todo-category-cache';

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
      await queryClient.cancelQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.list(), exact: true });

      const previousData = queryClient.getQueryData(TODO_CATEGORY_QUERY_KEYS.list());

      const lastSortOrder = previousData?.categories.at(-1)?.sortOrder ?? 0;

      const optimisticCategory: OptimisticTodoCategoryWithCount = {
        id: createOptimisticId(),
        name: input.name,
        color: input.color,
        sortOrder: lastSortOrder + 1,
        todoCount: 0,
        optimistic: true,
      };

      queryClient.setQueryData(
        TODO_CATEGORY_QUERY_KEYS.list(),
        (old) => old && withCategoryAdded(old, optimisticCategory),
      );

      return { previousData };
    },
    onSuccess: (_data, variables) => {
      // 카테고리 수가 한도(TODO_CATEGORY)를 쓰므로 남은 개수를 다시 받는다
      invalidateEntitlements(queryClient);
      toast.success(t('todo:toast.categoryAdded'));
      trackEvent('category_created', { color: variables.color });
    },
    onError: (error, _variables, context) => {
      if (context?.previousData != null) {
        queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), context.previousData);
      }

      // 카테고리 한도는 시트의 한도 게이트가 프리미엄 안내 시트로 안내한다
      if (findLimitedFeature(error) != null) {
        return;
      }

      haptics.notify('error');
      toast.error(getUserFacingMessage(error), {
        fallback: t('todo:toast.addFailedRetry'),
      });
    },
    // 임시 id를 서버 id로 바꾼다. 새 카테고리에는 아직 할 일이 없어 할 일 조회는 그대로다
    onSettled: () => invalidateTodoCategories(queryClient),
  });
}

interface UpdateTodoCategoryVariables {
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
    mutationFn: async ({ id, input }: UpdateTodoCategoryVariables) =>
      unwrap(await todoCategoryService.updateCategory(id, input)),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.list(), exact: true });

      const previousData = queryClient.getQueryData(TODO_CATEGORY_QUERY_KEYS.list());

      queryClient.setQueryData(
        TODO_CATEGORY_QUERY_KEYS.list(),
        (old) => old && withCategoryChanged(old, id, input),
      );

      return { previousData };
    },
    onSuccess: (_data, variables, context) => {
      // 할 일 행과 달력 점이 카테고리 이름·색을 함께 보여 준다
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
    onSettled: () => invalidateTodoCategories(queryClient),
  });
}

interface DeleteTodoCategoryVariables {
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
    mutationFn: async ({ id, query }: DeleteTodoCategoryVariables) =>
      unwrap(await todoCategoryService.deleteCategory(id, query)),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.list(), exact: true });

      const previousData = queryClient.getQueryData(TODO_CATEGORY_QUERY_KEYS.list());

      queryClient.setQueryData(
        TODO_CATEGORY_QUERY_KEYS.list(),
        (old) => old && withCategoryRemoved(old, id),
      );

      return { previousData };
    },
    onSuccess: () => {
      trackEvent('category_deleted');
      // 그 카테고리의 할 일이 옮겨지거나 지워져 어느 날짜가 바뀌었는지 모른다
      invalidateTodos(queryClient);
      // 카테고리 수가 한도(TODO_CATEGORY)를 돌려받으므로 남은 개수를 다시 받는다
      invalidateEntitlements(queryClient);
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
    onSettled: () => invalidateTodoCategories(queryClient),
  });
}

interface ReorderTodoCategoryVariables {
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
    mutationFn: async ({ id, input }: ReorderTodoCategoryVariables) =>
      unwrap(await todoCategoryService.reorderCategory(id, input)),
    onSuccess: () => {
      invalidateWidgetSummary(queryClient);
      trackEvent('category_reordered', { source: 'settings' });
      const accountId = getCachedMe(queryClient)?.id;
      if (accountId) {
        trackAttributedFeatureSuccess({ accountId, feature: 'category_reorder' });
      }
    },
    onError: (error) => {
      haptics.notify('error');
      toast.error(getUserFacingMessage(error), { fallback: t('todo:toast.changeFailedRetry') });
    },
    // 성공하면 서버 순서를, 실패하면 끌기 전 순서를 받아 화면이 붙잡은 순서를 놓는다
    onSettled: () => invalidateTodoCategories(queryClient),
  });
}
