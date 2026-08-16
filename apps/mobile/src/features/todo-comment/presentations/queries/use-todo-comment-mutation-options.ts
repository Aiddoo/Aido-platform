import type { UpdateTodoCommentInput } from '@aido/validators';
import { useTodoCommentService } from '@src/bootstrap/providers/di-context';
import { TODO_QUERY_KEYS } from '@src/features/todo/presentations/constants/todo-query-keys.constant';
import type { User } from '@src/features/user/models/user.model';
import { USER_QUERY_KEYS } from '@src/features/user/presentations/constants/user-query-keys.constant';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { type QueryClient, mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import type {
  TodoCommentAuthor,
  TodoCommentDraft,
  TodoCommentPreview,
  TodoCommentSort,
  TodoCommentThread,
} from '../../models/todo-comment.model';
import { TODO_COMMENT_QUERY_KEYS } from '../constants/todo-comment-query-keys.constant';

export interface WriteTodoCommentsVariables {
  /** 어느 글에 다는지. 없으면 할 일에 바로 단다. */
  parentId: string | null;
  draft: TodoCommentDraft;
}
import {
  type CommentPages,
  findCommentInCache,
  patchCommentEverywhere,
  patchThread,
  withAddedReply,
  withPrependedComment,
  withReplacedComment,
} from './todo-comment-cache.util';
import {
  contentEdited,
  likeSettled,
  likeToggled,
  nestChain,
  pendingCommentChain,
  replyCounted,
  tombstoned,
} from './todo-comment-optimistic';

/**
 * 낙관적 업데이트 3단(취소 → 스냅샷 → 반영) 중 앞의 둘.
 * 스냅샷은 캐시 키와 값을 그대로 들고 있어 onError에서 하나씩 되돌린다.
 */
async function snapshotCommentCaches(queryClient: QueryClient, todoId: number) {
  const scopeKey = TODO_COMMENT_QUERY_KEYS.all(todoId);

  await queryClient.cancelQueries({ queryKey: scopeKey });

  return queryClient.getQueriesData({ queryKey: scopeKey });
}

type CommentCacheSnapshot = Awaited<ReturnType<typeof snapshotCommentCaches>>;

function restoreCommentCaches(queryClient: QueryClient, snapshot: CommentCacheSnapshot) {
  snapshot.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data));
}

/** 할 일의 댓글 수는 상세 카드가 읽는 값이라 리페치 없이 제자리에서 맞춘다. */
function shiftTodoCommentCount(queryClient: QueryClient, todoId: number, delta: number) {
  queryClient.setQueryData<{ metrics: { commentCount: number } }>(
    TODO_QUERY_KEYS.details(todoId),
    (detail) =>
      detail === undefined
        ? detail
        : {
            ...detail,
            metrics: {
              ...detail.metrics,
              commentCount: Math.max(0, detail.metrics.commentCount + delta),
            },
          },
  );
}

export function useSetTodoCommentLikeMutationOptions(todoId: number) {
  const todoCommentService = useTodoCommentService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();

  return mutationOptions({
    mutationFn: async (variables: { commentId: string; isLiked: boolean }) =>
      unwrap(
        await todoCommentService.setCommentLike(todoId, variables.commentId, variables.isLiked),
      ),

    onMutate: async ({ commentId, isLiked }) => {
      const snapshot = await snapshotCommentCaches(queryClient, todoId);

      patchCommentEverywhere(queryClient, todoId, commentId, (comment) =>
        likeToggled(comment, isLiked),
      );

      return { snapshot };
    },

    onError: (_error, _variables, context) => {
      if (context) {
        restoreCommentCaches(queryClient, context.snapshot);
      }
    },

    // likeCount의 주인은 서버다. 리페치 대신 응답을 그대로 확정해 스크롤 위치를 지킨다.
    onSuccess: (result) => {
      patchCommentEverywhere(queryClient, todoId, result.commentId, (comment) =>
        likeSettled(comment, result),
      );

      trackEvent('todo_comment_liked', { todo_id: todoId, is_liked: result.isLiked });
    },
  });
}

export function useUpdateTodoCommentMutationOptions(todoId: number) {
  const todoCommentService = useTodoCommentService();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: async (variables: { commentId: string; input: UpdateTodoCommentInput }) =>
      unwrap(await todoCommentService.updateComment(todoId, variables.commentId, variables.input)),

    onMutate: async ({ commentId, input }) => {
      const snapshot = await snapshotCommentCaches(queryClient, todoId);

      patchCommentEverywhere(queryClient, todoId, commentId, (comment) =>
        contentEdited(comment, input.content),
      );

      return { snapshot };
    },

    onError: (_error, _variables, context) => {
      if (context) {
        restoreCommentCaches(queryClient, context.snapshot);
      }
    },

    onSuccess: (comment) =>
      patchCommentEverywhere(queryClient, todoId, comment.id, (cached) => ({
        ...cached,
        content: comment.content,
        isEdited: comment.isEdited,
        editedAt: comment.editedAt,
      })),
  });
}

export function useDeleteTodoCommentMutationOptions(todoId: number) {
  const todoCommentService = useTodoCommentService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();

  return mutationOptions({
    mutationFn: async ({ comment }: { comment: TodoCommentPreview }) =>
      unwrap(await todoCommentService.deleteComment(todoId, comment.id)),

    // 서버도 소프트 삭제라 낙관적 모양과 실제 응답 모양이 같다.
    onMutate: async ({ comment }) => {
      const snapshot = await snapshotCommentCaches(queryClient, todoId);

      patchCommentEverywhere(queryClient, todoId, comment.id, tombstoned);
      shiftTodoCommentCount(queryClient, todoId, -1);

      return { snapshot };
    },

    onError: (_error, _variables, context) => {
      if (context) {
        restoreCommentCaches(queryClient, context.snapshot);
        shiftTodoCommentCount(queryClient, todoId, 1);
      }
    },

    onSuccess: (_data, { comment }) =>
      trackEvent('todo_comment_deleted', { todo_id: todoId, depth: comment.depth }),
  });
}

/**
 * 댓글 작성. 대상은 쓸 때마다 달라지므로 변수로 받는다 —
 * parentId가 없으면 할 일에 바로 달리고, 있으면 그 댓글의 답글이 된다.
 * 여러 개를 이어 쓰면 앞 글의 답글로 사슬이 되어 목록에는 첫 글만 선다.
 */
export function useWriteTodoCommentsMutationOptions(todoId: number, sort: TodoCommentSort) {
  const todoCommentService = useTodoCommentService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();

  const listKeyFor = (parentId: string | null) =>
    TODO_COMMENT_QUERY_KEYS.commentsBySort(todoId, parentId, sort);

  return mutationOptions({
    mutationFn: async ({ parentId, draft }: WriteTodoCommentsVariables) =>
      unwrap(
        await todoCommentService.writeComments(todoId, parentId, {
          items: draft.contents.map((content) => ({
            clientRequestId: Crypto.randomUUID(),
            content,
          })),
        }),
      ),

    onMutate: async ({ parentId, draft }) => {
      const author = findMyAuthorProfile(queryClient, todoId);
      const parent = parentId === null ? null : findCommentInCache(queryClient, todoId, parentId);

      if (author === undefined || parent === undefined) {
        return undefined;
      }

      const snapshot = await snapshotCommentCaches(queryClient, todoId);
      const pending = pendingCommentChain({
        todoId,
        createdAt: new Date(),
        author,
        parent,
        items: draft.contents.map((content) => ({ id: Crypto.randomUUID(), content })),
      });

      queryClient.setQueryData<CommentPages>(listKeyFor(parentId), (pages) =>
        withPrependedComment(pages, pending),
      );

      // 부모가 어느 목록에 떠 있든 답글 수는 하나만 오른다 — 직계 자식은 첫 글뿐이다.
      queryClient.setQueriesData<CommentPages>(
        { queryKey: TODO_COMMENT_QUERY_KEYS.lists(todoId) },
        (pages) => withAddedReply(pages, pending),
      );
      queryClient.setQueriesData<TodoCommentThread>(
        { queryKey: TODO_COMMENT_QUERY_KEYS.threads(todoId) },
        (thread) => patchThread(thread, parentId ?? '', replyCounted),
      );

      shiftTodoCommentCount(queryClient, todoId, draft.contents.length);

      return { snapshot, pendingId: pending.id };
    },

    onError: (_error, variables, context) => {
      if (context) {
        restoreCommentCaches(queryClient, context.snapshot);
        shiftTodoCommentCount(queryClient, todoId, -variables.draft.contents.length);
      }
    },

    onSuccess: ({ comments }, { parentId }, context) => {
      const written = comments[0];

      if (written === undefined) {
        return;
      }

      trackEvent('todo_comment_created', { todo_id: todoId, depth: written.depth });

      const pendingId = context?.pendingId;

      if (pendingId === undefined) {
        queryClient.invalidateQueries({ queryKey: listKeyFor(parentId) });

        return;
      }

      queryClient.setQueryData<CommentPages>(listKeyFor(parentId), (pages) =>
        withReplacedComment(pages, pendingId, nestChain(comments)),
      );
    },
  });
}

/**
 * 대기 행과 작성 시트가 함께 쓰는 내 작성자 정보.
 * 이미 받아둔 캐시만 읽어 새 구독이나 요청을 만들지 않는다.
 */
export function findMyAuthorProfile(
  queryClient: QueryClient,
  todoId: number,
): TodoCommentAuthor | undefined {
  const me = queryClient.getQueryData<User>(USER_QUERY_KEYS.me());

  if (me === undefined) {
    return undefined;
  }

  const detail = queryClient.getQueryData<{ owner: { id: string } }>(
    TODO_QUERY_KEYS.details(todoId),
  );

  return {
    id: me.id,
    name: me.name,
    profileImage: me.profileImage,
    isTodoOwner: detail?.owner.id === me.id,
  };
}
