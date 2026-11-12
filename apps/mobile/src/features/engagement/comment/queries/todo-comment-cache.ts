import { invalidateTodoSummaries } from '@src/features/planning/todo/queries/todo-cache';
import type {
  DefaultError,
  InfiniteQueryExecuteOptions,
  QueryClient,
  QueryKey,
} from '@tanstack/react-query';

import type {
  TodoComment,
  TodoCommentReplyPage,
  TodoCommentThreadPage,
} from '../domains/todo-comment.model';
import {
  addRepliesToThreadPages,
  appendRepliesToReplyPages,
  findCommentInReplyPages,
  findCommentInThreadPages,
  findReplyPlacement,
  findThreadPlacement,
  patchCommentInReplyPages,
  patchCommentInThreadPages,
  removeCommentFromReplyPages,
  removeCommentFromThreadPages,
  restoreCommentInReplyPages,
  restoreCommentInThreadPages,
  type TodoCommentPageParam,
  type TodoCommentPlacement,
  type TodoCommentReplyPages,
  type TodoCommentThreadPlacement,
  type TodoCommentThreadPages,
  type TodoCommentTransform,
} from './todo-comment-pages-cache';
import { TODO_COMMENT_QUERY_KEYS } from './todo-comment-query-keys';

/** 묶음 목록 조회 옵션. 조회 함수가 DI Api를 써서 `useGetTodoCommentThreadsInfiniteQueryOptions`가 만든다 */
type TodoCommentThreadsQueryOptions<TData> = InfiniteQueryExecuteOptions<
  TodoCommentThreadPage,
  DefaultError,
  TData,
  ReturnType<typeof TODO_COMMENT_QUERY_KEYS.threads>,
  TodoCommentPageParam
>;

/** 답글 목록 조회 옵션. 조회 함수가 DI Api를 써서 `useGetTodoCommentRepliesInfiniteQueryOptions`가 만든다 */
type TodoCommentRepliesQueryOptions<TData> = InfiniteQueryExecuteOptions<
  TodoCommentReplyPage,
  DefaultError,
  TData,
  ReturnType<typeof TODO_COMMENT_QUERY_KEYS.replies>,
  TodoCommentPageParam
>;

interface TodoCommentCacheInput {
  todoId: number;
}

/** 지운 댓글이 목록마다 있던 자리. 실패하면 그 댓글만 되돌린다 */
export interface TodoCommentPlacements {
  threads: ReadonlyArray<readonly [queryKey: QueryKey, placement: TodoCommentThreadPlacement]>;
  replies: ReadonlyArray<readonly [queryKey: QueryKey, placement: TodoCommentPlacement]>;
}

function threadQueries(todoId: number) {
  return { queryKey: TODO_COMMENT_QUERY_KEYS.threadLists({ todoId }) };
}

function replyQueries(todoId: number) {
  return { queryKey: TODO_COMMENT_QUERY_KEYS.replyLists({ todoId }) };
}

/** 이미 받은 데이터가 있는 쿼리만 멈춘다. 첫 로드를 끊으면 idle로 되돌아가 다시 받지 않아 스켈레톤에 멈춘다 */
export function cancelTodoCommentQueries(
  queryClient: QueryClient,
  { todoId }: TodoCommentCacheInput,
) {
  return queryClient.cancelQueries({
    queryKey: TODO_COMMENT_QUERY_KEYS.todo({ todoId }),
    predicate: (query) => query.state.data != null,
  });
}

export function findTodoCommentPlacements(
  queryClient: QueryClient,
  { todoId, comment }: TodoCommentCacheInput & { comment: TodoComment },
): TodoCommentPlacements {
  return {
    threads: queryClient
      .getQueriesData<TodoCommentThreadPages>(threadQueries(todoId))
      .flatMap(([queryKey, data]) => {
        const placement = findThreadPlacement(data, comment);
        return placement == null ? [] : [[queryKey, placement] as const];
      }),
    replies: queryClient
      .getQueriesData<TodoCommentReplyPages>(replyQueries(todoId))
      .flatMap(([queryKey, data]) => {
        const placement = findReplyPlacement(data, comment.id);
        return placement == null ? [] : [[queryKey, placement] as const];
      }),
  };
}

/** 그 댓글 하나만 지운 자리에 되돌린다. 목록을 통째로 되돌리면 그사이 누른 하트·지운 다른 댓글이 사라진다 */
export function restoreTodoCommentToCaches(
  queryClient: QueryClient,
  { comment, placements }: { comment: TodoComment; placements: TodoCommentPlacements },
) {
  for (const [queryKey, placement] of placements.threads) {
    queryClient.setQueriesData<TodoCommentThreadPages>({ queryKey, exact: true }, (data) =>
      restoreCommentInThreadPages(data, comment, placement),
    );
  }
  for (const [queryKey, placement] of placements.replies) {
    queryClient.setQueriesData<TodoCommentReplyPages>({ queryKey, exact: true }, (data) =>
      restoreCommentInReplyPages(data, comment, placement),
    );
  }
}

export function findCachedTodoComment(
  queryClient: QueryClient,
  { todoId, commentId }: TodoCommentCacheInput & { commentId: string },
): TodoComment | null {
  const fromReplies = queryClient
    .getQueriesData<TodoCommentReplyPages>(replyQueries(todoId))
    .map(([_queryKey, data]) => findCommentInReplyPages(data, commentId))
    .find((comment) => comment != null);

  return (
    fromReplies ??
    queryClient
      .getQueriesData<TodoCommentThreadPages>(threadQueries(todoId))
      .map(([_queryKey, data]) => findCommentInThreadPages(data, commentId))
      .find((comment) => comment != null) ??
    null
  );
}

export function patchTodoCommentCaches(
  queryClient: QueryClient,
  {
    todoId,
    commentId,
    transform,
  }: TodoCommentCacheInput & { commentId: string; transform: TodoCommentTransform },
) {
  queryClient.setQueriesData<TodoCommentThreadPages>(threadQueries(todoId), (data) =>
    patchCommentInThreadPages(data, commentId, transform),
  );
  queryClient.setQueriesData<TodoCommentReplyPages>(replyQueries(todoId), (data) =>
    patchCommentInReplyPages(data, commentId, transform),
  );
}

export function removeTodoCommentFromCaches(
  queryClient: QueryClient,
  { todoId, comment }: TodoCommentCacheInput & { comment: TodoComment },
) {
  queryClient.setQueriesData<TodoCommentThreadPages>(threadQueries(todoId), (data) =>
    removeCommentFromThreadPages(data, comment),
  );
  queryClient.setQueriesData<TodoCommentReplyPages>(replyQueries(todoId), (data) =>
    removeCommentFromReplyPages(data, comment.id),
  );
}

/** 새 답글은 그 묶음의 답글 끝과 묶음 수에만 반영한다. 다른 묶음은 다시 받지 않는다 */
export function addTodoCommentRepliesToCaches(
  queryClient: QueryClient,
  {
    todoId,
    threadCommentId,
    replies,
  }: TodoCommentCacheInput & { threadCommentId: string; replies: readonly TodoComment[] },
) {
  queryClient.setQueriesData<TodoCommentThreadPages>(threadQueries(todoId), (data) =>
    addRepliesToThreadPages(data, threadCommentId, replies),
  );
  queryClient.setQueriesData<TodoCommentReplyPages>(
    { queryKey: TODO_COMMENT_QUERY_KEYS.threadReplies({ todoId, commentId: threadCommentId }) },
    (data) => appendRepliesToReplyPages(data, replies),
  );
}

/** 정렬을 바꾸기 전에 그 정렬의 묶음 목록을 받는다. 받은 첫 페이지가 있으면 다시 받지 않는다 */
export function fetchTodoCommentThreads<TData>(
  queryClient: QueryClient,
  options: TodoCommentThreadsQueryOptions<TData>,
) {
  return queryClient.infiniteQuery(options);
}

/** 펼치기 전에 답글을 받는다. 한 번 받은 답글은 다시 받지 않는다 */
export function ensureTodoCommentReplies<TData>(
  queryClient: QueryClient,
  options: TodoCommentRepliesQueryOptions<TData>,
) {
  return queryClient.infiniteQuery({ ...options, staleTime: 'static' });
}

/** 새 댓글의 자리(정렬·페이지)는 서버가 정하므로 묶음 목록만 다시 받는다 */
export function invalidateTodoCommentThreads(
  queryClient: QueryClient,
  { todoId }: TodoCommentCacheInput,
) {
  return queryClient.invalidateQueries(threadQueries(todoId));
}

export function invalidateTodoCommentCount(
  queryClient: QueryClient,
  { todoId }: TodoCommentCacheInput,
) {
  return invalidateTodoSummaries(queryClient, { todoId });
}

export function invalidateTodoComments(
  queryClient: QueryClient,
  { todoId }: TodoCommentCacheInput,
) {
  return queryClient.invalidateQueries({ queryKey: TODO_COMMENT_QUERY_KEYS.todo({ todoId }) });
}
