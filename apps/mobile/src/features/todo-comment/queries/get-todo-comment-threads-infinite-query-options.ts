import { TODO_COMMENT_SORT, type TodoCommentSort } from '@aido/api';
import { useTodoCommentService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { infiniteQueryOptions } from '@tanstack/react-query';

import type { TodoCommentService } from '../apis/todo-comment.service';
import { TODO_COMMENT_QUERY_KEYS } from '../constants/todo-comment-query-keys';
import { TODO_COMMENT_QUERY_TIMING } from '../constants/todo-comment.constants';
import { TodoCommentPolicy } from '../domains/todo-comment.model';
import type { TodoCommentThreadPages } from '../utils/todo-comment-cache-pages';
import {
  INITIAL_TODO_COMMENT_PAGE_PARAM,
  nextPageParamOf,
  previousPageParamOf,
  toThreadsQuery,
} from '../utils/todo-comment-page-params';

interface TodoCommentThreadsParams {
  todoId: number;
  sort: TodoCommentSort;
  anchorCommentId: string | null;
}

function selectTodoCommentThreads(data: TodoCommentThreadPages) {
  return {
    threads: TodoCommentPolicy.flattenThreads(data.pages),
    anchor: TodoCommentPolicy.anchorOf(data.pages),
  };
}

export function getTodoCommentThreadsInfiniteQueryOptions(
  service: TodoCommentService,
  { todoId, sort, anchorCommentId }: TodoCommentThreadsParams,
) {
  return infiniteQueryOptions({
    queryKey: TODO_COMMENT_QUERY_KEYS.threads({ todoId, sort, anchorCommentId }),
    initialPageParam: INITIAL_TODO_COMMENT_PAGE_PARAM,
    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await service.getThreads(
          todoId,
          toThreadsQuery(pageParam, { sort, anchorCommentId }),
          signal,
        ),
      ),
    getNextPageParam: (lastPage) => nextPageParamOf(lastPage.pagination),
    getPreviousPageParam: (firstPage) => previousPageParamOf(firstPage.pagination),
    staleTime:
      sort === TODO_COMMENT_SORT.POPULAR
        ? TODO_COMMENT_QUERY_TIMING.popularStaleTime
        : TODO_COMMENT_QUERY_TIMING.latestStaleTime,
    gcTime: TODO_COMMENT_QUERY_TIMING.gcTime,
    select: selectTodoCommentThreads,
  });
}

export function useGetTodoCommentThreadsInfiniteQueryOptions(params: TodoCommentThreadsParams) {
  return getTodoCommentThreadsInfiniteQueryOptions(useTodoCommentService(), params);
}
