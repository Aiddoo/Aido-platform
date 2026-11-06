import { useTodoCommentService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { NetworkError, ServerError, TimeoutError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import { match, P } from 'ts-pattern';

import { TODO_COMMENT_MUTATION_KEYS } from '../constants/todo-comment-mutation-keys';
import { TodoCommentPolicy } from '../domains/todo-comment.model';
import { useTodoCommentMutationErrorHandler } from '../hooks/use-todo-comment-mutation-error-handler';
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

interface CreateTodoCommentChainMutationParams {
  input: TodoCommentChainInput;
  /** 답글을 달 때 그 대상. 이미 지워졌으면 행을 캐시에서 뺀다 */
  target: TodoComment | null;
}

interface UpdateTodoCommentMutationParams {
  target: TodoComment;
  input: TodoCommentUpdateInput;
}

interface DeleteTodoCommentMutationParams {
  comment: TodoComment;
}

type TodoCommentLikeVia = 'button' | 'double_tap';

interface SetTodoCommentLikeMutationParams {
  isLiked: boolean;
  via: TodoCommentLikeVia;
}

function isRetryableCreationError(error: unknown) {
  return (
    error instanceof NetworkError || error instanceof ServerError || error instanceof TimeoutError
  );
}

/**
 * 서버가 id와 순서를 정하므로 낙관적 행은 넣지 않는다.
 * 답글은 그 묶음 끝에 붙이고, 새 댓글은 정렬 자리를 몰라 묶음 목록만 다시 받는다.
 */
export function useCreateTodoCommentChainMutationOptions({ todoId }: { todoId: number }) {
  const todoCommentService = useTodoCommentService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const handleMutationError = useTodoCommentMutationErrorHandler({ todoId });

  return mutationOptions({
    mutationKey: TODO_COMMENT_MUTATION_KEYS.createCommentChain(todoId),
    retry: (failureCount, error) =>
      failureCount < MAX_RETRY_COUNT && isRetryableCreationError(error),
    retryDelay: (attempt) => Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS),
    mutationFn: async ({ input }: CreateTodoCommentChainMutationParams) =>
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
          addTodoCommentRepliesToCaches({
            queryClient,
            todoId,
            threadCommentId,
            replies: comments,
          });
          return invalidateTodoCommentCount({ queryClient, todoId });
        })
        .otherwise(() =>
          Promise.all([
            invalidateTodoCommentThreads({ queryClient, todoId }),
            invalidateTodoCommentCount({ queryClient, todoId }),
          ]),
        );
    },
    onError: (error, { target }) => {
      handleMutationError(error, 'create', target ?? undefined);
    },
  });
}

export function useUpdateTodoCommentMutationOptions({ todoId }: { todoId: number }) {
  const todoCommentService = useTodoCommentService();
  const queryClient = useQueryClient();
  const handleMutationError = useTodoCommentMutationErrorHandler({ todoId });

  return mutationOptions({
    mutationKey: TODO_COMMENT_MUTATION_KEYS.updateComment(todoId),
    mutationFn: async ({ target, input }: UpdateTodoCommentMutationParams) =>
      unwrap(await todoCommentService.updateComment(todoId, target.id, input)),
    onMutate: async ({ target, input }) => {
      await cancelTodoCommentQueries({ queryClient, todoId });
      const snapshot = snapshotTodoCommentCaches({ queryClient, todoId });
      patchTodoCommentCaches({
        queryClient,
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
      handleMutationError(error, 'update', target);
    },
    onSuccess: (updated) => {
      patchTodoCommentCaches({
        queryClient,
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
  const handleMutationError = useTodoCommentMutationErrorHandler({ todoId });

  return mutationOptions({
    mutationFn: async ({ comment }: DeleteTodoCommentMutationParams) =>
      unwrap(await todoCommentService.deleteComment(todoId, comment.id)),
    onMutate: async ({ comment }) => {
      await cancelTodoCommentQueries({ queryClient, todoId });
      const snapshot = snapshotTodoCommentCaches({ queryClient, todoId });
      removeTodoCommentFromCaches({ queryClient, todoId, comment });
      return { snapshot };
    },
    onError: (error, { comment }, context) => {
      if (context != null) {
        restoreTodoCommentCaches(queryClient, context.snapshot);
      }
      handleMutationError(error, 'delete', comment);
    },
    onSuccess: (_commentId, { comment }) => {
      trackEvent('todo_comment_deleted', {
        todo_id: todoId,
        is_reply: TodoCommentPolicy.isReply(comment),
      });
      return invalidateTodoCommentCount({ queryClient, todoId });
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
  const handleMutationError = useTodoCommentMutationErrorHandler({ todoId });

  return mutationOptions({
    scope: { id: `todo-comment-like:${commentId}` },
    mutationFn: async ({ isLiked }: SetTodoCommentLikeMutationParams) =>
      unwrap(await todoCommentService.setCommentLike(todoId, commentId, isLiked)),
    onMutate: async ({ isLiked }) => {
      await cancelTodoCommentQueries({ queryClient, todoId });
      const snapshot = snapshotTodoCommentCaches({ queryClient, todoId });
      const target = findCachedTodoComment({ queryClient, todoId, commentId });
      patchTodoCommentCaches({
        queryClient,
        todoId,
        commentId,
        transform: (comment) => TodoCommentPolicy.withLikeToggled(comment, isLiked),
      });
      return { snapshot, target };
    },
    onError: (error, _params, context) => {
      if (context != null) {
        restoreTodoCommentCaches(queryClient, context.snapshot);
      }
      handleMutationError(error, 'like', context?.target);
    },
    onSuccess: (result, { via }) => {
      trackEvent('todo_comment_liked', { todo_id: todoId, is_liked: result.isLiked, via });
      patchTodoCommentCaches({
        queryClient,
        todoId,
        commentId: result.commentId,
        transform: (comment) => TodoCommentPolicy.withLikeResult(comment, result),
      });
    },
  });
}
