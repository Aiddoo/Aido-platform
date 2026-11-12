import { isLastMutation } from '@src/shared/query/is-last-mutation';
import type { FetchQueryOptions, QueryClient } from '@tanstack/react-query';
import { pick } from 'es-toolkit';

import type {
  TodoCategoriesResult,
  TodoCategory,
  TodoCategoryDeletionPreview,
  TodoCategoryDeletionResult,
  TodoCategoryWithCount,
} from '../domains/todo-category.model';
import { TODO_CATEGORY_MUTATION_KEYS } from './todo-category-mutation-keys';
import { TODO_CATEGORY_QUERY_KEYS } from './todo-category-query-keys';

/** 만들기 응답 전에 목록에 먼저 그리는 임시 행 */
export type OptimisticTodoCategoryWithCount = TodoCategoryWithCount & { readonly optimistic: true };

export function withCategoryAdded(
  result: TodoCategoriesResult,
  category: TodoCategoryWithCount,
): TodoCategoriesResult {
  return { ...result, categories: [...result.categories, category] };
}

/**
 * 만들기 응답의 서버 값으로 임시 행을 바꾼다. 새 카테고리라 할 일 수는 그대로(0)다.
 * 그사이 다시 받아 임시 행이 사라졌으면 서버 행이 없을 때만 끝에 붙인다
 */
export function withCategorySaved(
  result: TodoCategoriesResult,
  optimisticCategoryId: number,
  savedCategory: TodoCategory,
): TodoCategoriesResult {
  if (result.categories.some(({ id }) => id === optimisticCategoryId)) {
    return {
      ...result,
      categories: result.categories.map((category) =>
        category.id === optimisticCategoryId
          ? { ...savedCategory, todoCount: category.todoCount }
          : category,
      ),
    };
  }
  if (result.categories.some(({ id }) => id === savedCategory.id)) {
    return result;
  }
  return withCategoryAdded(result, { ...savedCategory, todoCount: 0 });
}

export function withCategoryRemoved(
  result: TodoCategoriesResult,
  categoryId: number,
): TodoCategoriesResult {
  return { ...result, categories: result.categories.filter(({ id }) => id !== categoryId) };
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

/** 지운 카테고리를 빼고, 옮겼으면 옮긴 곳에 옮긴 할 일 수를 더한다 */
export function withCategoryDeleted(
  result: TodoCategoriesResult,
  categoryId: number,
  deletionResult: TodoCategoryDeletionResult,
): TodoCategoriesResult {
  const remaining = withCategoryRemoved(result, categoryId);

  if (deletionResult.todoHandling !== 'move' || deletionResult.moveToCategoryId == null) {
    return remaining;
  }

  return withTodoCountChanged(remaining, deletionResult.moveToCategoryId, deletionResult.todoCount);
}

/** 훅 밖에서 이미 받은 카테고리만 읽는다. 받지 않았으면 없다 */
export function getCachedTodoCategories(queryClient: QueryClient) {
  return queryClient.getQueryData(TODO_CATEGORY_QUERY_KEYS.list());
}

/** 낙관적으로 고치기 전에 진행 중인 목록 조회를 멈춰 늦은 응답이 고친 값을 덮지 않게 한다 */
export function cancelTodoCategories(queryClient: QueryClient) {
  return queryClient.cancelQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.list(), exact: true });
}

/** 받은 목록만 고친다. 받지 않았으면 새로 만들지 않는다 */
export function updateCachedTodoCategories(
  queryClient: QueryClient,
  update: (result: TodoCategoriesResult) => TodoCategoriesResult,
) {
  queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), (old) => old && update(old));
}

export function invalidateTodoCategories(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.all });
}

/**
 * 이름·색 고치기 응답을 쓴다. 겹친 고치기는 응답 순서가 서버가 처리한 순서와 다를 수 있어, 앞서 끝난 응답은 낡음만
 * 표시하고 마지막 고치기가 겹쳤으면 응답 대신 다시 받는다. 그동안은 마지막에 고친 낙관적 값이 보인다. 쓰기 콜백 안에서 부른다
 */
export function settleTodoCategoryChange(
  queryClient: QueryClient,
  { saved, startedWithOthers }: { saved: TodoCategory; startedWithOthers: boolean },
) {
  const listKey = TODO_CATEGORY_QUERY_KEYS.list();
  if (!isLastMutation(queryClient, TODO_CATEGORY_MUTATION_KEYS.writes())) {
    return queryClient.invalidateQueries({ queryKey: listKey, exact: true, refetchType: 'none' });
  }
  if (startedWithOthers || queryClient.getQueryState(listKey)?.isInvalidated === true) {
    return queryClient.invalidateQueries({ queryKey: listKey, exact: true });
  }
  updateCachedTodoCategories(queryClient, (result) =>
    withCategoryChanged(result, saved.id, pick(saved, ['name', 'color'])),
  );
  return Promise.resolve();
}

/** 할 일 하나를 만들거나 지운 응답으로 개수를 고친다. 목록 전체를 다시 받지 않는다 */
export function changeCachedCategoryTodoCount(
  queryClient: QueryClient,
  { categoryId, delta }: { categoryId: number; delta: number },
) {
  updateCachedTodoCategories(queryClient, (result) =>
    withTodoCountChanged(result, categoryId, delta),
  );
}

/** 삭제 응답으로 목록을 바로 고쳐 시트가 다시 받기를 기다리지 않고 닫힌다 */
export function removeDeletedCategory(
  queryClient: QueryClient,
  {
    categoryId,
    deletionResult,
  }: { categoryId: number; deletionResult: TodoCategoryDeletionResult },
) {
  updateCachedTodoCategories(queryClient, (result) =>
    withCategoryDeleted(result, categoryId, deletionResult),
  );
}

/** 삭제를 누를 때마다 지금 개수를 미리 받는다. 지난 미리보기를 먼저 버려 시트가 옛 개수로 그려지지 않는다 */
export function prefetchDeletionPreview(
  queryClient: QueryClient,
  options: FetchQueryOptions<
    TodoCategoryDeletionPreview,
    Error,
    TodoCategoryDeletionPreview,
    ReturnType<typeof TODO_CATEGORY_QUERY_KEYS.deletionPreview>
  >,
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
