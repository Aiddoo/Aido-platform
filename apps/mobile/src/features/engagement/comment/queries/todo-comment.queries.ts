import { TODO_COMMENT_SORT, type TodoCommentSort } from '@aido/api/vocabulary';
import { useTodoCommentService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { infiniteQueryOptions } from '@tanstack/react-query';

import { toRepliesQuery, toThreadsQuery } from '../apis/todo-comment.mapper';
import { TODO_COMMENT_QUERY_TIMING } from '../constants/todo-comment.constants';
import { TodoCommentPolicy } from '../domains/todo-comment.model';
import type {
  TodoCommentReplyPages,
  TodoCommentThreadPages,
} from '../utils/todo-comment-cache-pages';
import {
  INITIAL_TODO_COMMENT_PAGE_PARAM,
  getNextTodoCommentPageParam,
  getPreviousTodoCommentPageParam,
} from '../utils/todo-comment-page-params';
import { TODO_COMMENT_QUERY_KEYS } from './todo-comment-query-keys';

interface TodoCommentThreadsQueryInput {
  todoId: number;
  sort: TodoCommentSort;
  anchorCommentId: string | null;
}

interface TodoCommentRepliesQueryInput {
  todoId: number;
  commentId: string;
  aroundReplyId: string | null;
  /** 묶음을 펼쳤을 때만 받는다 */
  isEnabled: boolean;
}

function selectTodoCommentThreads(data: TodoCommentThreadPages) {
  return {
    threads: TodoCommentPolicy.flattenThreads(data.pages),
    anchor: data.pages[0]?.anchor ?? null,
  };
}

function selectTodoCommentReplies(data: TodoCommentReplyPages) {
  return TodoCommentPolicy.flattenReplies(data.pages);
}

export function useGetTodoCommentThreadsInfiniteQueryOptions({
  todoId,
  sort,
  anchorCommentId,
}: TodoCommentThreadsQueryInput) {
  const todoCommentService = useTodoCommentService();

  return infiniteQueryOptions({
    queryKey: TODO_COMMENT_QUERY_KEYS.threads({ todoId, sort, anchorCommentId }),
    initialPageParam: INITIAL_TODO_COMMENT_PAGE_PARAM,
    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await todoCommentService.getThreads(
          todoId,
          toThreadsQuery(pageParam, { sort, anchorCommentId }),
          signal,
        ),
      ),
    getNextPageParam: (lastPage) => getNextTodoCommentPageParam(lastPage.pagination),
    getPreviousPageParam: (firstPage) => getPreviousTodoCommentPageParam(firstPage.pagination),
    staleTime:
      sort === TODO_COMMENT_SORT.POPULAR
        ? TODO_COMMENT_QUERY_TIMING.popularStaleTime
        : TODO_COMMENT_QUERY_TIMING.latestStaleTime,
    gcTime: TODO_COMMENT_QUERY_TIMING.gcTime,
    select: selectTodoCommentThreads,
    meta: { refreshOnBlockChange: true },
  });
}

export function useGetTodoCommentRepliesInfiniteQueryOptions({
  todoId,
  commentId,
  aroundReplyId,
  isEnabled,
}: TodoCommentRepliesQueryInput) {
  const todoCommentService = useTodoCommentService();

  return infiniteQueryOptions({
    queryKey: TODO_COMMENT_QUERY_KEYS.replies({ todoId, commentId, aroundReplyId }),
    initialPageParam: INITIAL_TODO_COMMENT_PAGE_PARAM,
    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await todoCommentService.getReplies(
          todoId,
          commentId,
          toRepliesQuery(pageParam, { aroundReplyId }),
          signal,
        ),
      ),
    getNextPageParam: (lastPage) => getNextTodoCommentPageParam(lastPage.pagination),
    getPreviousPageParam: (firstPage) => getPreviousTodoCommentPageParam(firstPage.pagination),
    enabled: isEnabled,
    staleTime: TODO_COMMENT_QUERY_TIMING.latestStaleTime,
    gcTime: TODO_COMMENT_QUERY_TIMING.gcTime,
    select: selectTodoCommentReplies,
    meta: { refreshOnBlockChange: true },
  });
}
