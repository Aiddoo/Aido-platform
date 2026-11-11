import { useTodoCategoryApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { isLimitedFeatureError } from '@src/features/billing/subscription/domains/entitlement.error';
import { invalidateEntitlements } from '@src/features/billing/subscription/queries/entitlement-cache';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import {
  invalidateCategorizedTodos,
  invalidateTodoDependentQueries,
  invalidateWidgetSummary,
} from '@src/features/planning/todo/queries/todo-cache';
import { useTrack } from '@src/shared/analytics';
import { t } from '@src/shared/i18n';
import { isLastMutation } from '@src/shared/query/is-last-mutation';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { createOptimisticId } from '@src/shared/utils/create-optimistic-id';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import { pick } from 'es-toolkit';

import { isDeletionPreviewOutdatedError } from '../domains/todo-category.error';
import { TodoCategoryPolicy } from '../domains/todo-category.model';
import type {
  TodoCategoryDeletionRequest,
  TodoCategoryDeletionResult,
  TodoCategoryWithCount,
} from '../domains/todo-category.model';
import type { TodoCategoryFormValues } from '../schemas/todo-category-form.schema';
import type {
  TodoCategoryChange,
  TodoCategoryReorder,
} from '../schemas/todo-category-request.schema';
import {
  getCategoryDeletedTodoHandling,
  getCategoryUpdatedField,
  toTodoCountBucket,
} from '../utils/todo-category-analytics';
import {
  invalidateDeletionPreview,
  invalidateTodoCategories,
  type OptimisticTodoCategoryWithCount,
  removeDeletedCategory,
  withCategoryAdded,
  withCategoryChanged,
  withCategoryRemoved,
  withCategorySaved,
} from './todo-category-cache';
import { TODO_CATEGORY_MUTATION_KEYS } from './todo-category-mutation-keys';
import { TODO_CATEGORY_QUERY_KEYS } from './todo-category-query-keys';

export function useCreateTodoCategoryMutationOptions() {
  const todoCategoryApi = useTodoCategoryApi();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    // 연결이 없을 때 요청을 쥐고 기다리면 저장 시트가 스피너만 돈다. 바로 실패해 입력값을 지킨다
    networkMode: 'always',
    mutationKey: TODO_CATEGORY_MUTATION_KEYS.writes(),
    mutationFn: async (input: TodoCategoryFormValues) =>
      unwrap(await todoCategoryApi.createCategory(input)),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.list(), exact: true });

      const lastSortOrder =
        queryClient.getQueryData(TODO_CATEGORY_QUERY_KEYS.list())?.categories.at(-1)?.sortOrder ??
        0;

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

      return { optimisticCategoryId: optimisticCategory.id };
    },
    onSuccess: (savedCategory, variables, { optimisticCategoryId }) => {
      queryClient.setQueryData(
        TODO_CATEGORY_QUERY_KEYS.list(),
        (old) => old && withCategorySaved(old, optimisticCategoryId, savedCategory),
      );
      // 카테고리 수가 한도(TODO_CATEGORY)를 쓰므로 남은 개수를 다시 받는다
      invalidateEntitlements(queryClient);
      toast.success(t('todo:toast.categoryAdded'));
      trackEvent('category_created', { color: variables.color });
    },
    onError: (_error, _variables, context) => {
      if (context != null) {
        queryClient.setQueryData(
          TODO_CATEGORY_QUERY_KEYS.list(),
          (old) => old && withCategoryRemoved(old, context.optimisticCategoryId),
        );
      }
    },
    // 응답으로 임시 행을 이미 바꿨다. 기다리면 저장한 시트가 목록을 다시 받을 때까지 닫히지 않는다
    onSettled: (_data, error) => {
      if (error != null && isLastMutation(queryClient, TODO_CATEGORY_MUTATION_KEYS.writes())) {
        invalidateTodoCategories(queryClient);
      }
    },
    meta: {
      errorFeedback: {
        feature: 'todo',
        fallbackKey: 'todo:toast.addFailedRetry',
        // 카테고리 한도는 시트의 한도 게이트가 프리미엄 안내 시트로 안내한다
        isHandledByFeature: isLimitedFeatureError,
      },
    },
  });
}

interface UpdateTodoCategoryVariables {
  id: number;
  input: TodoCategoryChange;
}

export function useUpdateTodoCategoryMutationOptions() {
  const todoCategoryApi = useTodoCategoryApi();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    networkMode: 'always',
    mutationKey: TODO_CATEGORY_MUTATION_KEYS.writes(),
    mutationFn: async ({ id, input }: UpdateTodoCategoryVariables) =>
      unwrap(await todoCategoryApi.updateCategory(id, input)),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.list(), exact: true });

      const previous = TodoCategoryPolicy.findCategory(
        queryClient.getQueryData(TODO_CATEGORY_QUERY_KEYS.list())?.categories ?? [],
        id,
      );

      queryClient.setQueryData(
        TODO_CATEGORY_QUERY_KEYS.list(),
        (old) => old && withCategoryChanged(old, id, input),
      );

      return { previous };
    },
    onSuccess: (savedCategory, variables, { previous }) => {
      if (isLastMutation(queryClient, TODO_CATEGORY_MUTATION_KEYS.writes())) {
        queryClient.setQueryData(
          TODO_CATEGORY_QUERY_KEYS.list(),
          (old) =>
            old && withCategoryChanged(old, variables.id, pick(savedCategory, ['name', 'color'])),
        );
      }
      toast.success(t('todo:toast.categoryUpdated'));
      trackEvent('category_updated', {
        field: getCategoryUpdatedField(previous, variables.input),
      });
    },
    // 목록을 통째로 되돌리면 그사이 바뀐 할 일 수와 다른 카테고리 변경을 지운다. 이 카테고리의 이름·색만 되돌린다
    onError: (_error, { id }, context) => {
      const previous = context?.previous;
      if (previous != null) {
        queryClient.setQueryData(
          TODO_CATEGORY_QUERY_KEYS.list(),
          (old) => old && withCategoryChanged(old, id, pick(previous, ['name', 'color'])),
        );
      }
    },
    // 기다리면 저장한 시트가 목록을 다시 받을 때까지 닫히지 않는다
    onSettled: (_data, error) => {
      if (error == null) {
        // 할 일 행·달력 점·할 일 상세가 카테고리 이름·색을 함께 보여 준다
        invalidateCategorizedTodos(queryClient);
        return;
      }
      if (isLastMutation(queryClient, TODO_CATEGORY_MUTATION_KEYS.writes())) {
        invalidateTodoCategories(queryClient);
      }
    },
    meta: { errorFeedback: { feature: 'todo', fallbackKey: 'todo:toast.updateFailedRetry' } },
  });
}

interface DeleteTodoCategoryVariables {
  id: number;
  deletion: TodoCategoryDeletionRequest;
}

/** 옮기거나 함께 지운 할 일이 있으면 그 결과를, 없으면 삭제만 알린다 */
function getCategoryDeletedMessage(
  deletionResult: TodoCategoryDeletionResult,
  categories: readonly TodoCategoryWithCount[],
  categoryId: number,
) {
  if (deletionResult.todoCount === 0) {
    return t('todo:toast.categoryDeleted');
  }

  const moveTarget =
    deletionResult.moveToCategoryId == null
      ? null
      : TodoCategoryPolicy.findCategory(categories, deletionResult.moveToCategoryId);
  const category = TodoCategoryPolicy.findCategory(categories, categoryId);

  if (deletionResult.todoHandling === 'move' && moveTarget != null) {
    return t('todo:toast.categoryTodosMoved', {
      count: deletionResult.todoCount,
      name: moveTarget.name,
    });
  }
  if (deletionResult.todoHandling === 'delete' && category != null) {
    return t('todo:toast.categoryDeletedWithTodos', {
      count: deletionResult.todoCount,
      name: category.name,
    });
  }

  return t('todo:toast.categoryDeleted');
}

export function useDeleteTodoCategoryMutationOptions() {
  const todoCategoryApi = useTodoCategoryApi();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    // 오프라인에 멈춰 두면 삭제 중 표시가 끝나지 않는다. 바로 실패해 시트를 그대로 두고 알린다
    networkMode: 'always',
    mutationFn: async ({ id, deletion }: DeleteTodoCategoryVariables) =>
      unwrap(await todoCategoryApi.deleteCategory(id, deletion)),
    // 되돌릴 수 없는 삭제라 목록에서 미리 빼지 않고, 결과 안내에 쓸 이름만 지우기 전 목록에서 잡아 둔다
    onMutate: () => ({
      categories: queryClient.getQueryData(TODO_CATEGORY_QUERY_KEYS.list())?.categories ?? [],
    }),
    onSuccess: (deletionResult, { id, deletion }, context) => {
      trackEvent('category_deleted', {
        todo_handling: getCategoryDeletedTodoHandling(deletion),
        todo_count_bucket: toTodoCountBucket(deletionResult.todoCount),
      });
      // 응답으로 목록을 고쳐(옮긴 곳 개수 포함) 시트가 다시 받기를 기다리지 않고 닫힌다
      removeDeletedCategory(queryClient, { categoryId: id, deletionResult });
      toast.success(getCategoryDeletedMessage(deletionResult, context.categories, id));
    },
    onError: (error, { id }) => {
      if (isDeletionPreviewOutdatedError(error)) {
        invalidateDeletionPreview(queryClient, { categoryId: id });
      }
    },
    // 기다리면 지운 뒤 시트가 할 일을 다시 받을 때까지 닫히지 않는다
    onSettled: (_deletionResult, error) => {
      if (error != null) {
        invalidateTodoCategories(queryClient);
        return;
      }
      // 그 카테고리의 할 일이 옮겨지거나 지워져 어느 날짜(목록·달력의 완료 기록)·상세가 바뀌었는지 모른다.
      // 카테고리 목록은 응답으로 고쳐 다시 받지 않는다
      invalidateCategorizedTodos(queryClient);
      invalidateTodoDependentQueries(queryClient);
      // 카테고리 수가 한도(TODO_CATEGORY)를 돌려받으므로 남은 개수를 다시 받는다
      invalidateEntitlements(queryClient);
    },
    meta: { errorFeedback: { feature: 'todo', fallbackKey: 'todo:toast.deleteFailedRetry' } },
  });
}

interface ReorderTodoCategoryVariables {
  id: number;
  input: TodoCategoryReorder;
}

export function useReorderTodoCategoryMutationOptions() {
  const todoCategoryApi = useTodoCategoryApi();
  const queryClient = useQueryClient();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();

  return mutationOptions({
    // 저장하는 동안 목록이 끌기 전 순서를 붙잡는다. 오프라인에 멈춰 두면 연결될 때까지 묶이니 바로 실패해 제자리로 돌리고 알린다
    networkMode: 'always',
    mutationFn: async ({ id, input }: ReorderTodoCategoryVariables) =>
      unwrap(await todoCategoryApi.reorderCategory(id, input)),
    onSuccess: () => {
      invalidateWidgetSummary(queryClient);
      trackEvent('category_reordered', { source: 'settings' });
      const accountId = getCachedMe(queryClient)?.id;
      if (accountId) {
        trackAttributedFeatureSuccess({ accountId, feature: 'category_reorder' });
      }
    },
    // 성공하면 서버 순서를, 실패하면 끌기 전 순서를 받아 화면이 붙잡은 순서를 놓는다
    onSettled: () => invalidateTodoCategories(queryClient),
    meta: { errorFeedback: { feature: 'todo', fallbackKey: 'todo:toast.changeFailedRetry' } },
  });
}
