import { invalidateTodoSummaries } from '@src/features/planning/todo/queries/todo-cache';
import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { TODO_COMMENT_QUERY_KEYS } from '../constants/todo-comment-query-keys';
import type { TodoComment } from '../domains/todo-comment.model';
import {
  addRepliesToThreadPages,
  appendRepliesToReplyPages,
  findCommentInReplyPages,
  findCommentInThreadPages,
  patchCommentInReplyPages,
  patchCommentInThreadPages,
  removeCommentFromReplyPages,
  removeCommentFromThreadPages,
  type TodoCommentReplyPages,
  type TodoCommentThreadPages,
  type TodoCommentTransform,
} from '../utils/todo-comment-cache-pages';

interface TodoCommentCacheParams {
  queryClient: QueryClient;
  todoId: number;
}

type CacheEntry<TData> = readonly [queryKey: QueryKey, data: TData | undefined];

/** 낙관적 갱신 직전의 묶음·답글 캐시. 실패하면 그대로 되돌린다 */
export interface TodoCommentCacheSnapshot {
  threads: readonly CacheEntry<TodoCommentThreadPages>[];
  replies: readonly CacheEntry<TodoCommentReplyPages>[];
}

function threadQueries(todoId: number) {
  return { queryKey: TODO_COMMENT_QUERY_KEYS.threadLists(todoId) };
}

function replyQueries(todoId: number) {
  return { queryKey: TODO_COMMENT_QUERY_KEYS.replyLists(todoId) };
}

export function cancelTodoCommentQueries({ queryClient, todoId }: TodoCommentCacheParams) {
  return queryClient.cancelQueries({ queryKey: TODO_COMMENT_QUERY_KEYS.todo(todoId) });
}

export function snapshotTodoCommentCaches({
  queryClient,
  todoId,
}: TodoCommentCacheParams): TodoCommentCacheSnapshot {
  return {
    threads: queryClient.getQueriesData<TodoCommentThreadPages>(threadQueries(todoId)),
    replies: queryClient.getQueriesData<TodoCommentReplyPages>(replyQueries(todoId)),
  };
}

export function restoreTodoCommentCaches(
  queryClient: QueryClient,
  snapshot: TodoCommentCacheSnapshot,
) {
  snapshot.threads.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data));
  snapshot.replies.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data));
}

export function findCachedTodoComment({
  queryClient,
  todoId,
  commentId,
}: TodoCommentCacheParams & { commentId: string }): TodoComment | undefined {
  const fromReplies = queryClient
    .getQueriesData<TodoCommentReplyPages>(replyQueries(todoId))
    .map(([_queryKey, data]) => findCommentInReplyPages(data, commentId))
    .find((comment) => comment != null);

  return (
    fromReplies ??
    queryClient
      .getQueriesData<TodoCommentThreadPages>(threadQueries(todoId))
      .map(([_queryKey, data]) => findCommentInThreadPages(data, commentId))
      .find((comment) => comment != null)
  );
}

export function patchTodoCommentCaches({
  queryClient,
  todoId,
  commentId,
  transform,
}: TodoCommentCacheParams & { commentId: string; transform: TodoCommentTransform }) {
  queryClient.setQueriesData<TodoCommentThreadPages>(threadQueries(todoId), (data) =>
    patchCommentInThreadPages(data, commentId, transform),
  );
  queryClient.setQueriesData<TodoCommentReplyPages>(replyQueries(todoId), (data) =>
    patchCommentInReplyPages(data, commentId, transform),
  );
}

export function removeTodoCommentFromCaches({
  queryClient,
  todoId,
  comment,
}: TodoCommentCacheParams & { comment: TodoComment }) {
  queryClient.setQueriesData<TodoCommentThreadPages>(threadQueries(todoId), (data) =>
    removeCommentFromThreadPages(data, comment),
  );
  queryClient.setQueriesData<TodoCommentReplyPages>(replyQueries(todoId), (data) =>
    removeCommentFromReplyPages(data, comment.id),
  );
}

/** 새 답글은 그 묶음의 답글 끝과 묶음 수에만 반영한다. 다른 묶음은 다시 받지 않는다 */
export function addTodoCommentRepliesToCaches({
  queryClient,
  todoId,
  threadCommentId,
  replies,
}: TodoCommentCacheParams & { threadCommentId: string; replies: readonly TodoComment[] }) {
  queryClient.setQueriesData<TodoCommentThreadPages>(threadQueries(todoId), (data) =>
    addRepliesToThreadPages(data, threadCommentId, replies),
  );
  queryClient.setQueriesData<TodoCommentReplyPages>(
    { queryKey: TODO_COMMENT_QUERY_KEYS.thread({ todoId, commentId: threadCommentId }) },
    (data) => appendRepliesToReplyPages(data, replies),
  );
}

/** 새 댓글의 자리(정렬·페이지)는 서버가 정하므로 묶음 목록만 다시 받는다 */
export function invalidateTodoCommentThreads({ queryClient, todoId }: TodoCommentCacheParams) {
  return queryClient.invalidateQueries(threadQueries(todoId));
}

export function invalidateTodoCommentCount({ queryClient, todoId }: TodoCommentCacheParams) {
  return invalidateTodoSummaries(queryClient, { todoId });
}

export function refreshTodoComments({ queryClient, todoId }: TodoCommentCacheParams) {
  return queryClient.invalidateQueries({ queryKey: TODO_COMMENT_QUERY_KEYS.todo(todoId) });
}

/** 차단처럼 여러 할 일의 댓글 표시가 함께 바뀔 때 불러 둔 모든 댓글 목록을 다시 받는다 */
export function invalidateAllTodoComments(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: TODO_COMMENT_QUERY_KEYS.all });
}
