import type {
  GetTodoCommentRepliesQuery,
  GetTodoCommentThreadsQuery,
  TodoCommentCursorPagination,
  TodoCommentSort,
} from '@aido/api';

import { TODO_COMMENT_PAGE_SIZE } from '../constants/todo-comment.constants';
import type { TodoCommentPageParam } from './todo-comment-cache-pages';

export const INITIAL_TODO_COMMENT_PAGE_PARAM: TodoCommentPageParam = null;

export function getNextTodoCommentPageParam({ hasNext, nextCursor }: TodoCommentCursorPagination) {
  return hasNext && nextCursor != null ? nextCursor : undefined;
}

export function getPreviousTodoCommentPageParam({
  hasPrevious,
  previousCursor,
}: TodoCommentCursorPagination) {
  return hasPrevious && previousCursor != null ? previousCursor : undefined;
}

/** 첫 페이지만 anchor로 위치를 찾고, 이어지는 페이지는 서버가 준 cursor를 그대로 보낸다 */
export function toThreadsQuery(
  pageParam: TodoCommentPageParam,
  { sort, anchorCommentId }: { sort: TodoCommentSort; anchorCommentId: string | null },
): GetTodoCommentThreadsQuery {
  const common = { sort, size: TODO_COMMENT_PAGE_SIZE.THREADS };

  if (pageParam != null) {
    return { ...common, cursor: pageParam };
  }

  return anchorCommentId == null ? common : { ...common, anchorCommentId };
}

export function toRepliesQuery(
  pageParam: TodoCommentPageParam,
  { aroundReplyId }: { aroundReplyId: string | null },
): GetTodoCommentRepliesQuery {
  const common = { size: TODO_COMMENT_PAGE_SIZE.REPLIES };

  if (pageParam != null) {
    return { ...common, cursor: pageParam };
  }

  return aroundReplyId == null ? common : { ...common, aroundReplyId };
}
