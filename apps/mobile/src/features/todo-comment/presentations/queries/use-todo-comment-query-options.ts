import { TODO_COMMENT_LIMITS } from '@aido/validators';
import { useTodoCommentService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import {
  type InfiniteData,
  infiniteQueryOptions,
  queryOptions,
  useQueryClient,
} from '@tanstack/react-query';
import { uniqBy } from 'es-toolkit';

import type {
  TodoComment,
  TodoCommentPage,
  TodoCommentSort,
  TodoCommentThread,
} from '../../models/todo-comment.model';
import { resolveThreadContinuity } from '../components/thread-continuity';
import { TODO_COMMENT_QUERY_KEYS } from '../constants/todo-comment-query-keys.constant';
import { findCommentInCache } from './todo-comment-cache.util';

/** 목록이 그리는 한 줄 — 글과, 위아래로 선을 잇는지까지 다 들고 있다. */
export interface CommentRow {
  comment: TodoComment;
  continuesFromAbove: boolean;
  continuesBelow: boolean;
}

/**
 * 페이지를 펴고 중복을 걷어 그릴 수 있는 줄로 만든다.
 *
 * 방금 쓴 글은 정렬과 무관하게 맨 위에 꽂아두는데, 인기순에서는 좋아요가 0이라
 * 뒷 페이지에서 제자리로 한 번 더 실려 온다 — 먼저 그린 쪽만 남긴다.
 *
 * 훅 밖 모듈 스코프에 둬야 한다. TanStack은 select 함수의 참조가 같을 때만 결과를
 * 재사용하므로, 인라인으로 두면 매 렌더 새 배열이 나와 목록이 통째로 다시 그려진다.
 */
export const selectCommentRows = (data: InfiniteData<TodoCommentPage>): CommentRow[] => {
  const comments = uniqBy(
    data.pages.flatMap((page) => page.comments),
    (comment) => comment.id,
  );
  const continuity = resolveThreadContinuity(comments);

  return comments.map((comment, index) => ({
    comment,
    continuesFromAbove: continuity[index]?.continuesFromAbove ?? false,
    continuesBelow: continuity[index]?.continuesBelow ?? false,
  }));
};

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
    select: selectCommentRows,
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
