import type { CreateTodoCommentChainInput } from '@aido/api';
import { useTodoCommentService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { NetworkError, ServerError, TimeoutError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import { match, P } from 'ts-pattern';

import { TODO_COMMENT_MUTATION_KEYS } from '../constants/todo-comment-mutation-keys';
import type { TodoComment } from '../domains/todo-comment.model';
import { useTodoCommentMutationErrorHandler } from '../hooks/use-todo-comment-mutation-error-handler';
import {
  addTodoCommentRepliesToCaches,
  invalidateTodoCommentCount,
  invalidateTodoCommentThreads,
} from './todo-comment-cache';

const MAX_RETRY_COUNT = 2;
const RETRY_BASE_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 1_000;

interface CreateTodoCommentChainMutationParams {
  input: CreateTodoCommentChainInput;
  /** 답글을 달 때 그 대상. 이미 지워졌으면 행을 캐시에서 뺀다 */
  target: TodoComment | null;
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
  const service = useTodoCommentService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const handleMutationError = useTodoCommentMutationErrorHandler({ todoId });

  return mutationOptions({
    mutationKey: TODO_COMMENT_MUTATION_KEYS.createCommentChain(todoId),
    retry: (failureCount, error) =>
      failureCount < MAX_RETRY_COUNT && isRetryableCreationError(error),
    retryDelay: (attempt) => Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS),
    mutationFn: async ({ input }: CreateTodoCommentChainMutationParams) =>
      unwrap(await service.createCommentChain(todoId, input)),
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
