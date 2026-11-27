import { settleOverlappingWrite } from '@src/shared/query/settle-overlapping-write';
import type { DefaultError, QueryClient, QueryExecuteOptions } from '@tanstack/react-query';
import { noop, pick } from 'es-toolkit';

import {
  TodoCategoriesPolicy,
  type TodoCategoriesResult,
  type TodoCategoryWithCount,
} from '../domains/todo-categories.model';
import type {
  TodoCategoryDeletionPreview,
  TodoCategoryDeletionResult,
} from '../domains/todo-category-deletion.model';
import type { TodoCategory } from '../domains/todo-category.model';
import { TODO_CATEGORY_MUTATION_KEYS } from './todo-category-mutation-keys';
import { TODO_CATEGORY_QUERY_KEYS } from './todo-category-query-keys';

/** 만들기 응답 전에 목록에 먼저 그리는 임시 행 */
export type OptimisticTodoCategoryWithCount = TodoCategoryWithCount & { readonly optimistic: true };

/** 훅 밖에서 이미 받은 카테고리만 읽는다. 받지 않았으면 없다 */
export function getCachedTodoCategories(queryClient: QueryClient) {
  return queryClient.getQueryData(TODO_CATEGORY_QUERY_KEYS.list());
}

/** 낙관적으로 고치기 전에 진행 중인 목록 조회를 멈춰 늦은 응답이 고친 값을 덮지 않게 한다 */
export function cancelTodoCategories(queryClient: QueryClient) {
  return queryClient.cancelQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.list(), exact: true });
}

/** 받은 목록만 고친다. 받지 않았으면 새로 만들지 않는다 */
export function setTodoCategoriesInCache(
  queryClient: QueryClient,
  update: (result: TodoCategoriesResult) => TodoCategoriesResult,
) {
  queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), (old) => old && update(old));
}

export function invalidateTodoCategories(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.all });
}

/** 응답 순서는 서버 처리 순서와 다를 수 있어 앞선 응답은 낡음만 표시하고, 마지막 고치기가 겹쳤으면 응답 대신 다시 받는다 */
export function settleTodoCategoryChange(
  queryClient: QueryClient,
  { saved, startedWithOthers }: { saved: TodoCategory; startedWithOthers: boolean },
) {
  return settleOverlappingWrite(queryClient, {
    mutationKey: TODO_CATEGORY_MUTATION_KEYS.writes(),
    queryKey: TODO_CATEGORY_QUERY_KEYS.list(),
    startedWithOthers,
    writeResponse: () =>
      setTodoCategoriesInCache(queryClient, (result) =>
        TodoCategoriesPolicy.withCategoryChanged(result, saved.id, pick(saved, ['name', 'color'])),
      ),
  });
}

/** 할 일 하나를 만들거나 지운 응답으로 개수를 고친다. 목록 전체를 다시 받지 않는다 */
export function changeCachedCategoryTodoCount(
  queryClient: QueryClient,
  { categoryId, delta }: { categoryId: number; delta: number },
) {
  setTodoCategoriesInCache(queryClient, (result) =>
    TodoCategoriesPolicy.withTodoCountChanged(result, categoryId, delta),
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
  setTodoCategoriesInCache(queryClient, (result) =>
    TodoCategoriesPolicy.withCategoryDeleted(result, categoryId, deletionResult),
  );
}

/** 삭제를 누를 때마다 지금 개수를 미리 받는다. 지난 미리보기를 먼저 버려 시트가 옛 개수로 그려지지 않는다 */
export function prefetchDeletionPreview(
  queryClient: QueryClient,
  options: QueryExecuteOptions<
    TodoCategoryDeletionPreview,
    DefaultError,
    TodoCategoryDeletionPreview,
    TodoCategoryDeletionPreview,
    ReturnType<typeof TODO_CATEGORY_QUERY_KEYS.deletionPreview>
  >,
) {
  queryClient.removeQueries({ queryKey: options.queryKey, exact: true });
  // 미리 받기라 실패는 시트가 열릴 때 그 조회가 다시 받아 보인다
  return queryClient.query(options).catch(noop);
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
