import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { TODO_COMMENT_QUERY_KEYS } from '../constants/todo-comment-query-keys';
import type { TodoComment } from '../domains/todo-comment.model';
import {
  type ConversationPages,
  findTodoCommentInConversationPages,
  findTodoCommentInOverviewPages,
  type OverviewPages,
  patchTodoCommentConversationPages,
  patchTodoCommentOverviewPages,
  type TodoCommentTransform,
} from '../utils/todo-comment-cache-pages';

type TodoCommentCacheSnapshotEntry = readonly [queryKey: QueryKey, comment: TodoComment];

export interface TodoCommentCacheSnapshot {
  commentId: string;
  conversations: readonly TodoCommentCacheSnapshotEntry[];
  overviews: readonly TodoCommentCacheSnapshotEntry[];
}

interface TodoCommentCacheParams {
  queryClient: QueryClient;
  todoId: number;
}

interface UpdateTodoCommentCachesParams extends TodoCommentCacheParams {
  commentId: string;
  transform: TodoCommentTransform;
}

interface RestoreTodoCommentCachesParams {
  queryClient: QueryClient;
  snapshot: TodoCommentCacheSnapshot;
}

function findTodoCommentCacheSnapshots<TData>(
  entries: [QueryKey, TData | undefined][],
  commentId: string,
  findComment: (data: TData | undefined, targetCommentId: string) => TodoComment | undefined,
): TodoCommentCacheSnapshotEntry[] {
  const snapshots: TodoCommentCacheSnapshotEntry[] = [];

  entries.forEach(([queryKey, data]) => {
    const comment = findComment(data, commentId);
    if (comment !== undefined) {
      snapshots.push([queryKey, comment]);
    }
  });

  return snapshots;
}

function createTodoCommentCacheSnapshot({
  queryClient,
  todoId,
  commentId,
}: TodoCommentCacheParams & { commentId: string }): TodoCommentCacheSnapshot {
  const conversations = queryClient.getQueriesData<ConversationPages>({
    queryKey: TODO_COMMENT_QUERY_KEYS.conversations({ todoId }),
  });
  const overviews = queryClient.getQueriesData<OverviewPages>({
    queryKey: TODO_COMMENT_QUERY_KEYS.overviews({ todoId }),
  });

  return {
    commentId,
    conversations: findTodoCommentCacheSnapshots(
      conversations,
      commentId,
      findTodoCommentInConversationPages,
    ),
    overviews: findTodoCommentCacheSnapshots(overviews, commentId, findTodoCommentInOverviewPages),
  };
}

/** 개요·대화 캐시 어디든 이미 불러온 댓글을 찾는다. */
export function findCachedTodoComment(
  params: TodoCommentCacheParams & { commentId: string },
): TodoComment | undefined {
  const snapshot = createTodoCommentCacheSnapshot(params);
  return (snapshot.conversations[0] ?? snapshot.overviews[0])?.[1];
}

export function updateTodoCommentCaches({
  queryClient,
  todoId,
  commentId,
  transform,
}: UpdateTodoCommentCachesParams): void {
  queryClient.setQueriesData<ConversationPages>(
    {
      queryKey: TODO_COMMENT_QUERY_KEYS.conversations({ todoId }),
    },
    (data) => patchTodoCommentConversationPages(data, commentId, transform),
  );
  queryClient.setQueriesData<OverviewPages>(
    {
      queryKey: TODO_COMMENT_QUERY_KEYS.overviews({ todoId }),
    },
    (data) => patchTodoCommentOverviewPages(data, commentId, transform),
  );
}

/**
 * 모든 댓글 query를 낙관적으로 갱신하고 query별 이전 댓글을 반환한다.
 * stale 정도가 다른 cache끼리 값을 공유하지 않는다.
 */
export function optimisticallyUpdateTodoCommentCaches({
  queryClient,
  todoId,
  commentId,
  transform,
}: UpdateTodoCommentCachesParams): TodoCommentCacheSnapshot {
  const snapshot = createTodoCommentCacheSnapshot({ queryClient, todoId, commentId });

  updateTodoCommentCaches({ queryClient, todoId, commentId, transform });
  return snapshot;
}

export function restoreTodoCommentCaches({
  queryClient,
  snapshot,
}: RestoreTodoCommentCachesParams): void {
  snapshot.conversations.forEach(([queryKey, comment]) => {
    queryClient.setQueryData<ConversationPages>(queryKey, (data) =>
      patchTodoCommentConversationPages(data, snapshot.commentId, () => comment),
    );
  });
  snapshot.overviews.forEach(([queryKey, comment]) => {
    queryClient.setQueryData<OverviewPages>(queryKey, (data) =>
      patchTodoCommentOverviewPages(data, snapshot.commentId, () => comment),
    );
  });
}
