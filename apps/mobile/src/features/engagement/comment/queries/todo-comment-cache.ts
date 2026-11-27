import { invalidateTodoSummaries } from '@src/features/planning/todo/queries/todo-cache';
import { isLastMutation } from '@src/shared/query/is-last-mutation';
import type {
  DefaultError,
  InfiniteQueryExecuteOptions,
  QueryClient,
  QueryKey,
} from '@tanstack/react-query';

import type {
  TodoCommentReplyPage,
  TodoCommentThreadPage,
} from '../domains/todo-comment-thread.model';
import type { TodoComment } from '../domains/todo-comment.model';
import { TODO_COMMENT_MUTATION_KEYS } from './todo-comment-mutation-keys';
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

/** 조회 함수가 DI Api를 써서 `useGetTodoCommentThreadsInfiniteQueryOptions`가 만든다 */
type TodoCommentThreadsQueryOptions<TData> = InfiniteQueryExecuteOptions<
  TodoCommentThreadPage,
  DefaultError,
  TData,
  ReturnType<typeof TODO_COMMENT_QUERY_KEYS.threads>,
  TodoCommentPageParam
>;

/** 조회 함수가 DI Api를 써서 `useGetTodoCommentRepliesInfiniteQueryOptions`가 만든다 */
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

export function getTodoCommentPlacements(
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

interface SettleTodoCommentEditInput extends TodoCommentCacheInput {
  /** 이 고치기가 시작할 때 같은 할 일의 다른 고치기가 진행 중이었는지(`onMutate`에서 센다) */
  startedWithOthers: boolean;
  /** 혼자 끝난 마지막 고치기의 응답을 캐시에 쓴다 */
  writeResponse: () => void;
}

/**
 * 글 고치기 응답을 반영한다. 응답이 오는 순서는 서버가 처리한 순서와 다를 수 있어 앞서 끝난 응답은 낡음만 표시하고,
 * 마지막 고치기가 겹쳤으면(시작할 때 다른 고치기가 있었거나 보이는 목록에 낡음 표시가 남음) 응답 대신 다시 받는다.
 * 댓글 하나가 정렬·위치별 묶음 목록과 답글 목록에 걸쳐 있어, 조회 하나를 맞추는 `settleOverlappingWrite`와 같은 갈래를
 * 이 할 일의 댓글 조회 전체에 건다. `onSuccess`에서 부른다
 */
export function settleTodoCommentEdit(
  queryClient: QueryClient,
  { todoId, startedWithOthers, writeResponse }: SettleTodoCommentEditInput,
): Promise<void> {
  const queryKey = TODO_COMMENT_QUERY_KEYS.todo({ todoId });
  if (!isLastMutation(queryClient, TODO_COMMENT_MUTATION_KEYS.updateComment({ todoId }))) {
    return queryClient.invalidateQueries({ queryKey, refetchType: 'none' });
  }
  // 보지 않는 목록(다른 정렬)은 새 댓글 뒤에도 낡음으로 남아 있어 겹침의 표시로 읽지 않는다
  const hasStaleMark = queryClient
    .getQueryCache()
    .findAll({ queryKey, type: 'active' })
    .some((query) => query.state.isInvalidated);
  if (startedWithOthers || hasStaleMark) {
    return queryClient.invalidateQueries({ queryKey });
  }
  writeResponse();
  return Promise.resolve();
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
