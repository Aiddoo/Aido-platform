import { useTodoCommentService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { useTrack } from '@src/shared/analytics';
import { NetworkError, ServerError, TimeoutError } from '@src/shared/errors';
import { t } from '@src/shared/i18n';
import { isLastMutation } from '@src/shared/query/is-last-mutation';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import { pick } from 'es-toolkit';
import { match, P } from 'ts-pattern';

import { TODO_COMMENT_MUTATION_KEYS } from '../constants/todo-comment-mutation-keys';
import {
  isTodoCommentRateLimitedError,
  isTodoCommentUnavailableError,
} from '../domains/todo-comment.error';
import { type TodoComment, TodoCommentPolicy } from '../domains/todo-comment.model';
import type {
  TodoCommentChainInput,
  TodoCommentUpdateInput,
} from '../schemas/todo-comment-request.schema';
import {
  addTodoCommentRepliesToCaches,
  cancelTodoCommentQueries,
  findCachedTodoComment,
  findTodoCommentPlacements,
  invalidateTodoCommentCount,
  invalidateTodoComments,
  invalidateTodoCommentThreads,
  patchTodoCommentCaches,
  removeTodoCommentFromCaches,
  restoreTodoCommentToCaches,
} from './todo-comment-cache';

const MAX_RETRY_COUNT = 2;
const RETRY_BASE_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 1_000;
/** 글 고치기가 바꾸는 칸. 실패하면 이 칸만 되돌리고 성공하면 이 칸만 응답으로 쓴다 */
const EDITED_FIELDS = ['content', 'isEdited', 'editedAt'] as const;

interface CreateTodoCommentChainVariables {
  input: TodoCommentChainInput;
  /** 답글을 달 때 그 대상. 이미 지워졌으면 행을 캐시에서 뺀다 */
  target: TodoComment | null;
}

interface UpdateTodoCommentVariables {
  target: TodoComment;
  input: TodoCommentUpdateInput;
}

interface DeleteTodoCommentVariables {
  comment: TodoComment;
}

type TodoCommentLikeVia = 'button' | 'double_tap';

interface SetTodoCommentLikeVariables {
  isLiked: boolean;
  via: TodoCommentLikeVia;
}

function isRetryableCreationError(error: unknown) {
  return (
    error instanceof NetworkError || error instanceof ServerError || error instanceof TimeoutError
  );
}

/** 지워진 댓글과 연타 제한은 onError가 경고 토스트로 알린다 */
function isWarnedTodoCommentError(error: unknown) {
  return isTodoCommentUnavailableError(error) || isTodoCommentRateLimitedError(error);
}

/**
 * 서버가 id와 순서를 정하므로 낙관적 행은 넣지 않는다.
 * 답글은 그 묶음 끝에 붙이고, 새 댓글은 정렬 자리를 몰라 묶음 목록만 다시 받는다.
 */
export function useCreateTodoCommentChainMutationOptions({ todoId }: { todoId: number }) {
  const todoCommentService = useTodoCommentService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const toast = useAppToast();

  return mutationOptions({
    // 오프라인에도 멈춰 기다리지 않고 바로 실패해 글자를 남긴 채 안내한다. 연결 뒤 몰래 보내지 않는다
    networkMode: 'always',
    mutationKey: TODO_COMMENT_MUTATION_KEYS.createCommentChain(todoId),
    retry: (failureCount, error) =>
      failureCount < MAX_RETRY_COUNT && isRetryableCreationError(error),
    retryDelay: (attempt) => Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS),
    mutationFn: async ({ input }: CreateTodoCommentChainVariables) =>
      unwrap(await todoCommentService.createCommentChain(todoId, input)),
    onSuccess: async ({ comments }, { input }) => {
      const [first] = comments;
      trackEvent('todo_comment_created', {
        todo_id: todoId,
        is_reply: input.parentId != null,
        chain_size: comments.length,
      });

      await match(first)
        .with({ threadCommentId: P.string }, ({ threadCommentId }) => {
          addTodoCommentRepliesToCaches(queryClient, {
            todoId,
            threadCommentId,
            replies: comments,
          });
          return invalidateTodoCommentCount(queryClient, { todoId });
        })
        .otherwise(() =>
          Promise.all([
            invalidateTodoCommentThreads(queryClient, { todoId }),
            invalidateTodoCommentCount(queryClient, { todoId }),
          ]),
        );
    },
    onError: (error, { target }) => {
      if (isTodoCommentUnavailableError(error)) {
        if (target != null) {
          removeTodoCommentFromCaches(queryClient, { todoId, comment: target });
        }
        toast.warning(t('todoComment:toasts.alreadyDeleted'));
        return;
      }
      if (isTodoCommentRateLimitedError(error)) {
        toast.warning(t('todoComment:toasts.throttled'));
      }
    },
    meta: {
      errorFeedback: {
        feature: 'todo_comment',
        fallbackKey: 'todoComment:toasts.writeFailed',
        isHandledByFeature: isWarnedTodoCommentError,
      },
    },
  });
}

export function useUpdateTodoCommentMutationOptions({ todoId }: { todoId: number }) {
  const todoCommentService = useTodoCommentService();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const mutationKey = TODO_COMMENT_MUTATION_KEYS.updateComment(todoId);

  return mutationOptions({
    // 새 댓글과 같은 이유로 오프라인에서 멈추지 않는다
    networkMode: 'always',
    mutationKey,
    mutationFn: async ({ target, input }: UpdateTodoCommentVariables) =>
      unwrap(await todoCommentService.updateComment(todoId, target.id, input)),
    onMutate: async ({ target, input }) => {
      await cancelTodoCommentQueries(queryClient, { todoId });
      const previous = findCachedTodoComment(queryClient, { todoId, commentId: target.id });
      patchTodoCommentCaches(queryClient, {
        todoId,
        commentId: target.id,
        transform: (comment) => TodoCommentPolicy.withContentEdited(comment, input.content),
      });
      return { previous };
    },
    onError: (error, { target }, context) => {
      if (isTodoCommentUnavailableError(error)) {
        removeTodoCommentFromCaches(queryClient, { todoId, comment: target });
        toast.warning(t('todoComment:toasts.alreadyDeleted'));
        return;
      }
      // 목록을 통째로 되돌리면 그사이 누른 하트·지운 댓글이 돌아온다. 이 댓글의 글만 되돌린다
      const previous = context?.previous;
      if (previous != null) {
        patchTodoCommentCaches(queryClient, {
          todoId,
          commentId: target.id,
          transform: (comment) => ({ ...comment, ...pick(previous, EDITED_FIELDS) }),
        });
      }
      if (isTodoCommentRateLimitedError(error)) {
        toast.warning(t('todoComment:toasts.throttled'));
      }
    },
    // 하트 수처럼 함께 바뀌는 값은 그 뮤테이션이 맞추므로 글 칸만 응답으로 쓴다
    onSuccess: (updated) => {
      if (isLastMutation(queryClient, mutationKey)) {
        patchTodoCommentCaches(queryClient, {
          todoId,
          commentId: updated.id,
          transform: (comment) => ({ ...comment, ...pick(updated, EDITED_FIELDS) }),
        });
      }
    },
    meta: {
      errorFeedback: {
        feature: 'todo_comment',
        fallbackKey: 'todoComment:toasts.updateFailed',
        isHandledByFeature: isWarnedTodoCommentError,
      },
    },
  });
}

/** 지우면 행을 먼저 빼고, 실패하면 그 댓글만 원래 자리에 되돌린다 */
export function useDeleteTodoCommentMutationOptions({ todoId }: { todoId: number }) {
  const todoCommentService = useTodoCommentService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const toast = useAppToast();
  const mutationKey = TODO_COMMENT_MUTATION_KEYS.deleteComment(todoId);

  return mutationOptions({
    // 지우는 동안 메뉴 버튼이 꺼진다. 오프라인에 멈춰 두면 연결될 때까지 꺼진 채 남으니 바로 실패해 되돌린다
    networkMode: 'always',
    mutationKey,
    mutationFn: async ({ comment }: DeleteTodoCommentVariables) =>
      unwrap(await todoCommentService.deleteComment(todoId, comment.id)),
    onMutate: async ({ comment }) => {
      await cancelTodoCommentQueries(queryClient, { todoId });
      const placements = findTodoCommentPlacements(queryClient, { todoId, comment });
      removeTodoCommentFromCaches(queryClient, { todoId, comment });
      return { placements };
    },
    onError: (error, { comment }, context) => {
      // 이미 지워졌으면 뺀 채로 둔다
      if (isTodoCommentUnavailableError(error)) {
        toast.warning(t('todoComment:toasts.alreadyDeleted'));
        return;
      }
      if (context != null) {
        restoreTodoCommentToCaches(queryClient, { comment, placements: context.placements });
      }
      if (isTodoCommentRateLimitedError(error)) {
        toast.warning(t('todoComment:toasts.throttled'));
      }
    },
    onSuccess: (_commentId, { comment }) => {
      trackEvent('todo_comment_deleted', {
        todo_id: todoId,
        is_reply: TodoCommentPolicy.isReply(comment),
      });
    },
    // 응답이 할 일의 댓글 수를 주지 않아 다시 받는다. 이어 지우는 중이면 마지막 지우기가 한 번만 받는다
    onSettled: () =>
      isLastMutation(queryClient, mutationKey)
        ? invalidateTodoCommentCount(queryClient, { todoId })
        : undefined,
    meta: {
      errorFeedback: {
        feature: 'todo_comment',
        fallbackKey: 'todoComment:toasts.deleteFailed',
        isHandledByFeature: isWarnedTodoCommentError,
      },
    },
  });
}

/** 같은 댓글의 연타는 scope로 차례대로 보낸다. 다른 댓글과 목록은 다시 받지 않는다 */
export function useSetTodoCommentLikeMutationOptions({
  todoId,
  commentId,
}: {
  todoId: number;
  commentId: string;
}) {
  const todoCommentService = useTodoCommentService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const toast = useAppToast();
  const mutationKey = TODO_COMMENT_MUTATION_KEYS.likeComment({ todoId, commentId });

  return mutationOptions({
    // 하트는 먼저 바뀌고 버튼이 잠기지 않는다. 오프라인이면 멈춰 두었다가 연결되면 같은 순서로 보낸다
    scope: { id: `todo-comment-like:${commentId}` },
    mutationKey,
    mutationFn: async ({ isLiked }: SetTodoCommentLikeVariables) =>
      unwrap(await todoCommentService.setCommentLike(todoId, commentId, isLiked)),
    onMutate: async ({ isLiked }) => {
      await cancelTodoCommentQueries(queryClient, { todoId });
      const target = findCachedTodoComment(queryClient, { todoId, commentId });
      patchTodoCommentCaches(queryClient, {
        todoId,
        commentId,
        transform: (comment) => TodoCommentPolicy.withLiked(comment, isLiked),
      });
      return { target };
    },
    onError: (error, { isLiked }, context) => {
      if (isTodoCommentUnavailableError(error)) {
        if (context?.target != null) {
          removeTodoCommentFromCaches(queryClient, { todoId, comment: context.target });
        }
        toast.warning(t('todoComment:toasts.alreadyDeleted'));
        return;
      }
      // 뒤에 누른 하트가 기다리고 있으면 그 값이 사용자가 바란 마지막 상태라 그대로 둔다
      if (isLastMutation(queryClient, mutationKey)) {
        patchTodoCommentCaches(queryClient, {
          todoId,
          commentId,
          transform: (comment) => TodoCommentPolicy.withLiked(comment, !isLiked),
        });
      }
      if (isTodoCommentRateLimitedError(error)) {
        toast.warning(t('todoComment:toasts.throttled'));
      }
    },
    onSuccess: (result, { via }) => {
      trackEvent('todo_comment_liked', { todo_id: todoId, is_liked: result.isLiked, via });
      // 앞 응답을 쓰면 뒤에 누른 하트가 잠깐 되돌아 깜빡인다
      if (isLastMutation(queryClient, mutationKey)) {
        patchTodoCommentCaches(queryClient, {
          todoId,
          commentId: result.commentId,
          transform: (comment) => TodoCommentPolicy.withLikeResult(comment, result),
        });
      }
    },
    // 실패가 섞이면 하트 수가 서버와 다를 수 있다. 마지막 하트가 끝날 때 서버 값으로 맞춘다
    onSettled: (_result, error) => {
      if (error != null && isLastMutation(queryClient, mutationKey)) {
        invalidateTodoComments(queryClient, { todoId });
      }
    },
    meta: {
      errorFeedback: {
        feature: 'todo_comment',
        fallbackKey: 'todoComment:toasts.likeFailed',
        isHandledByFeature: isWarnedTodoCommentError,
      },
    },
  });
}
