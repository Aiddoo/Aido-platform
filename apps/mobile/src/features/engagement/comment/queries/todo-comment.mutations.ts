import {
  useErrorReporter,
  useHaptics,
  useTodoCommentService,
} from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { useTrack } from '@src/shared/analytics';
import {
  ApiError,
  getUserFacingMessage,
  isInfraError,
  NetworkError,
  ServerError,
  TimeoutError,
  toError,
} from '@src/shared/errors';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import { match, P } from 'ts-pattern';

import { TODO_COMMENT_MUTATION_KEYS } from '../constants/todo-comment-mutation-keys';
import {
  isTodoCommentRateLimitedError,
  isTodoCommentUnavailableError,
} from '../domains/todo-comment.error';
import { TodoCommentPolicy } from '../domains/todo-comment.model';
import type {
  TodoCommentChainInput,
  TodoCommentUpdateInput,
} from '../schemas/todo-comment-form.schema';
import type { TodoComment } from '../schemas/todo-comment.schema';
import {
  addTodoCommentRepliesToCaches,
  cancelTodoCommentQueries,
  findCachedTodoComment,
  invalidateTodoCommentCount,
  invalidateTodoCommentThreads,
  patchTodoCommentCaches,
  removeTodoCommentFromCaches,
  restoreTodoCommentCaches,
  snapshotTodoCommentCaches,
} from './todo-comment-cache';

const MAX_RETRY_COUNT = 2;
const RETRY_BASE_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 1_000;

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

/** 서버가 코드로 답하지 않은 실패만 Sentry에 남긴다. 예측한 거절은 토스트로 끝난다 */
function useReportUnexpectedTodoCommentError({ todoId }: { todoId: number }) {
  const errorReporter = useErrorReporter();

  return (error: unknown, method: 'POST' | 'PATCH' | 'DELETE' | 'PUT/DELETE') => {
    if (error instanceof ApiError) {
      return;
    }
    errorReporter.captureException(toError(error), {
      feature: 'todo_comment',
      endpoint: `v1/todos/${todoId}/comments`,
      method,
      statusCode: isInfraError(error) ? (error.statusCode ?? undefined) : undefined,
    });
  };
}

/**
 * 서버가 id와 순서를 정하므로 낙관적 행은 넣지 않는다.
 * 답글은 그 묶음 끝에 붙이고, 새 댓글은 정렬 자리를 몰라 묶음 목록만 다시 받는다.
 */
export function useCreateTodoCommentChainMutationOptions({ todoId }: { todoId: number }) {
  const todoCommentService = useTodoCommentService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const haptics = useHaptics();
  const toast = useAppToast();
  const reportUnexpectedError = useReportUnexpectedTodoCommentError({ todoId });

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
          removeTodoCommentFromCaches({ queryClient, todoId, comment: target });
        }
        toast.warning(t('todoComment:toasts.alreadyDeleted'));
        return;
      }
      if (isTodoCommentRateLimitedError(error)) {
        toast.warning(t('todoComment:toasts.throttled'));
        return;
      }

      reportUnexpectedError(error, 'POST');
      haptics.notify('error');
      toast.error(getUserFacingMessage(error), { fallback: t('todoComment:toasts.writeFailed') });
    },
  });
}

export function useUpdateTodoCommentMutationOptions({ todoId }: { todoId: number }) {
  const todoCommentService = useTodoCommentService();
  const queryClient = useQueryClient();
  const haptics = useHaptics();
  const toast = useAppToast();
  const reportUnexpectedError = useReportUnexpectedTodoCommentError({ todoId });

  return mutationOptions({
    // 새 댓글과 같은 이유로 오프라인에서 멈추지 않는다
    networkMode: 'always',
    mutationKey: TODO_COMMENT_MUTATION_KEYS.updateComment(todoId),
    mutationFn: async ({ target, input }: UpdateTodoCommentVariables) =>
      unwrap(await todoCommentService.updateComment(todoId, target.id, input)),
    onMutate: async ({ target, input }) => {
      await cancelTodoCommentQueries(queryClient, { todoId });
      const snapshot = snapshotTodoCommentCaches(queryClient, { todoId });
      patchTodoCommentCaches(queryClient, {
        todoId,
        commentId: target.id,
        transform: (comment) => TodoCommentPolicy.withContentEdited(comment, input.content),
      });
      return { snapshot };
    },
    onError: (error, { target }, context) => {
      if (context != null) {
        restoreTodoCommentCaches(queryClient, context.snapshot);
      }
      if (isTodoCommentUnavailableError(error)) {
        if (target != null) {
          removeTodoCommentFromCaches({ queryClient, todoId, comment: target });
        }
        toast.warning(t('todoComment:toasts.alreadyDeleted'));
        return;
      }
      if (isTodoCommentRateLimitedError(error)) {
        toast.warning(t('todoComment:toasts.throttled'));
        return;
      }

      reportUnexpectedError(error, 'PATCH');
      haptics.notify('error');
      toast.error(getUserFacingMessage(error), { fallback: t('todoComment:toasts.updateFailed') });
    },
    onSuccess: (updated) => {
      patchTodoCommentCaches(queryClient, {
        todoId,
        commentId: updated.id,
        transform: (comment) => ({ ...updated, replyCount: comment.replyCount }),
      });
    },
  });
}

/** 지우면 행을 먼저 빼고, 실패하면 지우기 전 캐시로 되돌린다 */
export function useDeleteTodoCommentMutationOptions({ todoId }: { todoId: number }) {
  const todoCommentService = useTodoCommentService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const haptics = useHaptics();
  const toast = useAppToast();
  const reportUnexpectedError = useReportUnexpectedTodoCommentError({ todoId });

  return mutationOptions({
    // 지우는 동안 메뉴 버튼이 꺼진다. 오프라인에 멈춰 두면 연결될 때까지 꺼진 채 남으니 바로 실패해 되돌린다
    networkMode: 'always',
    mutationFn: async ({ comment }: DeleteTodoCommentVariables) =>
      unwrap(await todoCommentService.deleteComment(todoId, comment.id)),
    onMutate: async ({ comment }) => {
      await cancelTodoCommentQueries(queryClient, { todoId });
      const snapshot = snapshotTodoCommentCaches(queryClient, { todoId });
      removeTodoCommentFromCaches(queryClient, { todoId, comment });
      return { snapshot };
    },
    onError: (error, { comment }, context) => {
      if (context != null) {
        restoreTodoCommentCaches(queryClient, context.snapshot);
      }
      if (isTodoCommentUnavailableError(error)) {
        if (comment != null) {
          removeTodoCommentFromCaches({ queryClient, todoId, comment: comment });
        }
        toast.warning(t('todoComment:toasts.alreadyDeleted'));
        return;
      }
      if (isTodoCommentRateLimitedError(error)) {
        toast.warning(t('todoComment:toasts.throttled'));
        return;
      }

      reportUnexpectedError(error, 'DELETE');
      haptics.notify('error');
      toast.error(getUserFacingMessage(error), { fallback: t('todoComment:toasts.deleteFailed') });
    },
    onSuccess: (_commentId, { comment }) => {
      trackEvent('todo_comment_deleted', {
        todo_id: todoId,
        is_reply: TodoCommentPolicy.isReply(comment),
      });
      return invalidateTodoCommentCount(queryClient, { todoId });
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
  const haptics = useHaptics();
  const toast = useAppToast();
  const reportUnexpectedError = useReportUnexpectedTodoCommentError({ todoId });

  return mutationOptions({
    // 하트는 먼저 바뀌고 버튼이 잠기지 않는다. 오프라인이면 멈춰 두었다가 연결되면 같은 순서로 보낸다
    scope: { id: `todo-comment-like:${commentId}` },
    mutationFn: async ({ isLiked }: SetTodoCommentLikeVariables) =>
      unwrap(await todoCommentService.setCommentLike(todoId, commentId, isLiked)),
    onMutate: async ({ isLiked }) => {
      await cancelTodoCommentQueries(queryClient, { todoId });
      const snapshot = snapshotTodoCommentCaches(queryClient, { todoId });
      const target = findCachedTodoComment(queryClient, { todoId, commentId });
      patchTodoCommentCaches(queryClient, {
        todoId,
        commentId,
        transform: (comment) => TodoCommentPolicy.withLiked(comment, isLiked),
      });
      return { snapshot, target };
    },
    onError: (error, _params, context) => {
      if (context != null) {
        restoreTodoCommentCaches(queryClient, context.snapshot);
      }
      if (isTodoCommentUnavailableError(error)) {
        if (context?.target != null) {
          removeTodoCommentFromCaches({ queryClient, todoId, comment: context?.target });
        }
        toast.warning(t('todoComment:toasts.alreadyDeleted'));
        return;
      }
      if (isTodoCommentRateLimitedError(error)) {
        toast.warning(t('todoComment:toasts.throttled'));
        return;
      }

      reportUnexpectedError(error, 'PUT/DELETE');
      haptics.notify('error');
      toast.error(getUserFacingMessage(error), { fallback: t('todoComment:toasts.likeFailed') });
    },
    onSuccess: (result, { via }) => {
      trackEvent('todo_comment_liked', { todo_id: todoId, is_liked: result.isLiked, via });
      patchTodoCommentCaches(queryClient, {
        todoId,
        commentId: result.commentId,
        transform: (comment) => TodoCommentPolicy.withLikeResult(comment, result),
      });
    },
  });
}
