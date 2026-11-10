import type { QueryClient } from '@tanstack/react-query';

import { TODO_CATEGORY_QUERY_KEYS } from '../constants/todo-category-query-keys';
import type {
  TodoCategoriesResult,
  TodoCategory,
  TodoCategoryDeletionResult,
  TodoCategoryWithCount,
} from '../domains/todo-category.model';
import type { useGetTodoCategoryDeletionPreviewQueryOptions } from './todo-category.queries';

/** 만들기 응답 전에 목록에 먼저 그리는 임시 행 */
export type OptimisticTodoCategoryWithCount = TodoCategoryWithCount & { readonly optimistic: true };

// 서버 응답 전의 임시 행은 음수 id다. 임시 id로는 요청을 보낼 수 없어 행 버튼과 옮길 곳에서 뺀다
export function isOptimisticCategory(category: Pick<TodoCategory, 'id'>) {
  return category.id < 0;
}

export function withCategoryAdded(
  result: TodoCategoriesResult,
  category: TodoCategoryWithCount,
): TodoCategoriesResult {
  return { ...result, categories: [...result.categories, category] };
}

export function withCategoryChanged(
  result: TodoCategoriesResult,
  categoryId: number,
  change: Partial<Pick<TodoCategory, 'name' | 'color'>>,
): TodoCategoriesResult {
  return {
    ...result,
    categories: result.categories.map((category) =>
      category.id === categoryId ? { ...category, ...change } : category,
    ),
  };
}

/** 할 일을 만들거나 지운 만큼 그 카테고리의 개수만 바꾼다. 개수는 서버가 세는 카테고리의 할 일 수와 같다 */
export function withTodoCountChanged(
  result: TodoCategoriesResult,
  categoryId: number,
  delta: number,
): TodoCategoriesResult {
  return {
    ...result,
    categories: result.categories.map((category) =>
      category.id === categoryId
        ? { ...category, todoCount: Math.max(0, category.todoCount + delta) }
        : category,
    ),
  };
}

/** 지운 카테고리를 빼고, 옮겼으면 옮긴 곳에 옮긴 할 일 수를 더한다. 결과가 없는 옛 서버는 다시 받을 때 맞춰진다 */
export function withCategoryDeleted(
  result: TodoCategoriesResult,
  categoryId: number,
  deletionResult: TodoCategoryDeletionResult | null,
): TodoCategoriesResult {
  const remaining = {
    ...result,
    categories: result.categories.filter(({ id }) => id !== categoryId),
  };

  if (deletionResult?.todoHandling !== 'move' || deletionResult.moveToCategoryId == null) {
    return remaining;
  }

  return withTodoCountChanged(remaining, deletionResult.moveToCategoryId, deletionResult.todoCount);
}

export function invalidateTodoCategories(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.all });
}

/** 할 일 하나를 만들거나 지운 응답으로 개수를 고친다. 목록 전체를 다시 받지 않는다 */
export function changeCachedCategoryTodoCount(
  queryClient: QueryClient,
  { categoryId, delta }: { categoryId: number; delta: number },
) {
  queryClient.setQueryData(
    TODO_CATEGORY_QUERY_KEYS.list(),
    (old) => old && withTodoCountChanged(old, categoryId, delta),
  );
}

/** 삭제 응답으로 목록을 바로 고쳐 시트가 다시 받기를 기다리지 않고 닫힌다 */
export function removeDeletedCategory(
  queryClient: QueryClient,
  {
    categoryId,
    deletionResult,
  }: { categoryId: number; deletionResult: TodoCategoryDeletionResult | null },
) {
  queryClient.setQueryData(
    TODO_CATEGORY_QUERY_KEYS.list(),
    (old) => old && withCategoryDeleted(old, categoryId, deletionResult),
  );
}

/** 삭제를 누를 때마다 지금 개수를 미리 받는다. 지난 미리보기를 먼저 버려 시트가 옛 개수로 그려지지 않는다 */
export function prefetchDeletionPreview(
  queryClient: QueryClient,
  options: ReturnType<typeof useGetTodoCategoryDeletionPreviewQueryOptions>,
) {
  queryClient.removeQueries({ queryKey: options.queryKey, exact: true });
  return queryClient.prefetchQuery(options);
}

/** 미리보기와 달라 서버가 거절하면(그사이 할 일이 생기거나 마지막 카테고리가 됨) 지금 개수로 다시 받아 고르기 화면을 맞춘다 */
export function invalidateDeletionPreview(
  queryClient: QueryClient,
  { categoryId }: { categoryId: number },
) {
  return queryClient.invalidateQueries({
    queryKey: TODO_CATEGORY_QUERY_KEYS.deletionPreview({ categoryId }),
    exact: true,
  });
}
