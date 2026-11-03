import { useTodoCommentService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { infiniteQueryOptions } from '@tanstack/react-query';

import type { TodoCommentService } from '../apis/todo-comment.service';
import { TODO_COMMENT_QUERY_KEYS } from '../constants/todo-comment-query-keys';
import { TODO_COMMENT_QUERY_TIMING } from '../constants/todo-comment.constants';
import { TodoCommentPolicy } from '../domains/todo-comment.model';
import type { TodoCommentReplyPages } from '../utils/todo-comment-cache-pages';
import {
  INITIAL_TODO_COMMENT_PAGE_PARAM,
  nextPageParamOf,
  previousPageParamOf,
  toRepliesQuery,
} from '../utils/todo-comment-page-params';

interface TodoCommentRepliesParams {
  todoId: number;
  commentId: string;
  aroundReplyId: string | null;
  /** 묶음을 펼쳤을 때만 받는다 */
  isEnabled: boolean;
}

function selectTodoCommentReplies(data: TodoCommentReplyPages) {
  return TodoCommentPolicy.flattenReplies(data.pages);
}

export function getTodoCommentRepliesInfiniteQueryOptions(
  service: TodoCommentService,
  { todoId, commentId, aroundReplyId, isEnabled }: TodoCommentRepliesParams,
) {
  return infiniteQueryOptions({
    queryKey: TODO_COMMENT_QUERY_KEYS.replies({ todoId, commentId, aroundReplyId }),
    initialPageParam: INITIAL_TODO_COMMENT_PAGE_PARAM,
    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await service.getReplies(
          todoId,
          commentId,
          toRepliesQuery(pageParam, { aroundReplyId }),
          signal,
        ),
      ),
    getNextPageParam: (lastPage) => nextPageParamOf(lastPage.pagination),
    getPreviousPageParam: (firstPage) => previousPageParamOf(firstPage.pagination),
    enabled: isEnabled,
    staleTime: TODO_COMMENT_QUERY_TIMING.latestStaleTime,
    gcTime: TODO_COMMENT_QUERY_TIMING.gcTime,
    select: selectTodoCommentReplies,
  });
}

export function useGetTodoCommentRepliesInfiniteQueryOptions(params: TodoCommentRepliesParams) {
  return getTodoCommentRepliesInfiniteQueryOptions(useTodoCommentService(), params);
}
