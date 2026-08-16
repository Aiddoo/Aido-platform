import { TODO_COMMENT_LIMITS } from '@aido/validators';
import { useTodoCommentService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { infiniteQueryOptions, queryOptions, useQueryClient } from '@tanstack/react-query';

import type { TodoCommentSort, TodoCommentThread } from '../../models/todo-comment.model';
import { TODO_COMMENT_QUERY_KEYS } from '../constants/todo-comment-query-keys.constant';
import { findCommentInCache } from './todo-comment-cache.util';

/**
 * 한 댓글의 직계 답글 목록. parentId가 없으면 할 일의 최상위 댓글 목록이다.
 * 두 화면이 같은 훅을 쓰므로 깊이가 얼마든 무한 스크롤이 똑같이 동작한다.
 * 정렬 전환의 깜빡임은 CommentSortBar가 prefetch로 없앤다.
 */
export function useTodoCommentsQueryOptions(
  todoId: number,
  parentId: string | null,
  sort: TodoCommentSort,
) {
  const todoCommentService = useTodoCommentService();

  return infiniteQueryOptions({
    queryKey: TODO_COMMENT_QUERY_KEYS.commentsBySort(todoId, parentId, sort),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await todoCommentService.getComments(todoId, parentId, {
          sort,
          cursor: pageParam,
          size: TODO_COMMENT_LIMITS.DEFAULT_PAGE_SIZE,
        }),
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

/**
 * 스레드 머리말(조상 사슬 + 지금 보는 댓글).
 * 앞 화면에서 넘어왔다면 그 목록 캐시의 스냅샷으로 첫 프레임을 채우고
 * 백그라운드에서 다시 확인한다 (updatedAt 0 → 항상 stale).
 */
export function useTodoCommentThreadQueryOptions(todoId: number, commentId: string) {
  const todoCommentService = useTodoCommentService();
  const queryClient = useQueryClient();

  return queryOptions({
    queryKey: TODO_COMMENT_QUERY_KEYS.thread(todoId, commentId),
    queryFn: async () => unwrap(await todoCommentService.getThread(todoId, commentId)),
    initialData: (): TodoCommentThread | undefined => {
      const comment = findCommentInCache(queryClient, todoId, commentId);

      // 조상은 앞 화면에 없던 정보라 서버가 답할 때까지 비워 둔다.
      return comment === undefined ? undefined : { ancestors: [], comment };
    },
    initialDataUpdatedAt: 0,
  });
}
