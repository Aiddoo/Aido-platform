import { TODO_COMMENT_SORT } from '@aido/validators';
import { useTodoCommentService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { type InfiniteData, infiniteQueryOptions } from '@tanstack/react-query';

import type { TodoCommentOverviewPage, TodoCommentSort } from '../../models/todo-comment.model';
import {
  TODO_COMMENT_QUERY_KEYS,
  TODO_COMMENT_QUERY_TIMING,
} from '../constants/todo-comment-query-keys.constant';
import {
  getNextTodoCommentPageParam,
  getPreviousTodoCommentPageParam,
  INITIAL_TODO_COMMENT_PAGE_PARAM,
  type TodoCommentCursorPageParam,
  toTodoCommentOverviewQuery,
} from '../utils/todo-comment-cursor-page';
import {
  toTodoCommentOverviewViewModel,
  type TodoCommentOverviewViewModel,
} from '../view-models/todo-comment-overview.view-model';

function selectTodoCommentOverview(
  data: InfiniteData<TodoCommentOverviewPage, TodoCommentCursorPageParam>,
): TodoCommentOverviewViewModel {
  return toTodoCommentOverviewViewModel(data.pages);
}

export function useTodoCommentOverviewQueryOptions({
  todoId,
  sort,
}: {
  todoId: number;
  sort: TodoCommentSort;
}) {
  const todoCommentService = useTodoCommentService();

  return infiniteQueryOptions({
    queryKey: TODO_COMMENT_QUERY_KEYS.overview({ todoId, sort }),
    initialPageParam: INITIAL_TODO_COMMENT_PAGE_PARAM,
    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await todoCommentService.getOverview(
          todoId,
          toTodoCommentOverviewQuery(pageParam, sort),
          signal,
        ),
      ),
    getPreviousPageParam: (firstPage) => getPreviousTodoCommentPageParam(firstPage.pagination),
    getNextPageParam: (lastPage) => getNextTodoCommentPageParam(lastPage.pagination),
    staleTime:
      sort === TODO_COMMENT_SORT.POPULAR
        ? TODO_COMMENT_QUERY_TIMING.popularStaleTime
        : TODO_COMMENT_QUERY_TIMING.latestStaleTime,
    gcTime: TODO_COMMENT_QUERY_TIMING.gcTime,
    select: selectTodoCommentOverview,
  });
}
