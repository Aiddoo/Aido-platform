import {
  TODO_COMMENT_LIMITS,
  type GetTodoCommentOverviewQuery,
  type GetTodoConversationQuery,
  type TodoCommentCursorPagination,
} from '@aido/validators';

import type { TodoCommentSort } from '../../models/todo-comment.model';

export type TodoCommentCursorPageParam =
  | { direction: 'initial' }
  | { direction: 'before'; cursor: string }
  | { direction: 'after'; cursor: string };

export const INITIAL_TODO_COMMENT_PAGE_PARAM: TodoCommentCursorPageParam = {
  direction: 'initial',
};

export function getPreviousTodoCommentPageParam({
  previousCursor,
  hasPrevious,
}: TodoCommentCursorPagination): TodoCommentCursorPageParam | undefined {
  return hasPrevious && previousCursor !== null
    ? { direction: 'before', cursor: previousCursor }
    : undefined;
}

export function getNextTodoCommentPageParam({
  nextCursor,
  hasNext,
}: TodoCommentCursorPagination): TodoCommentCursorPageParam | undefined {
  return hasNext && nextCursor !== null ? { direction: 'after', cursor: nextCursor } : undefined;
}

export function toTodoCommentOverviewQuery(
  pageParam: TodoCommentCursorPageParam,
  sort: TodoCommentSort,
): GetTodoCommentOverviewQuery {
  const common = { sort, size: TODO_COMMENT_LIMITS.DEFAULT_PAGE_SIZE };

  if (pageParam.direction === 'before') {
    return { ...common, before: pageParam.cursor };
  }

  if (pageParam.direction === 'after') {
    return { ...common, after: pageParam.cursor };
  }

  return common;
}

export function toTodoCommentConversationQuery(
  pageParam: TodoCommentCursorPageParam,
  sort: TodoCommentSort,
  focusCommentId: string | undefined,
): GetTodoConversationQuery {
  const common = { sort, size: TODO_COMMENT_LIMITS.DEFAULT_PAGE_SIZE };

  if (pageParam.direction === 'before') {
    return { ...common, before: pageParam.cursor };
  }

  if (pageParam.direction === 'after') {
    return { ...common, after: pageParam.cursor };
  }

  return focusCommentId === undefined ? common : { ...common, focusCommentId };
}
