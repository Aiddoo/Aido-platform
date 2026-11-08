import type { TodoCommentPagination } from '../domains/todo-comment.model';
import type { TodoCommentPageParam } from './todo-comment-cache-pages';

export const INITIAL_TODO_COMMENT_PAGE_PARAM: TodoCommentPageParam = null;

export function getNextTodoCommentPageParam({
  hasNext,
  nextCursor,
}: Pick<TodoCommentPagination, 'hasNext' | 'nextCursor'>) {
  return hasNext && nextCursor != null ? nextCursor : undefined;
}

export function getPreviousTodoCommentPageParam({
  hasPrevious,
  previousCursor,
}: Pick<TodoCommentPagination, 'hasPrevious' | 'previousCursor'>) {
  return hasPrevious && previousCursor != null ? previousCursor : undefined;
}
