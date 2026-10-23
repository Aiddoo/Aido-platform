import type { CreateTodoCommentChainInput } from '@aido/api';
import { useTodoCommentService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { NetworkError, ServerError, TimeoutError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_COMMENT_MUTATION_KEYS } from '../constants/todo-comment-mutation-keys';
import { useTodoCommentMutationErrorHandler } from '../hooks/use-todo-comment-mutation-error-handler';
import { invalidateTodoCommentQueries } from './todo-comment-query-invalidation';

type CreateTodoCommentChainMutationParams = CreateTodoCommentChainInput;

function isRetryableTodoCommentCreationError(
  error: unknown,
): error is NetworkError | ServerError | TimeoutError {
  return (
    error instanceof NetworkError || error instanceof ServerError || error instanceof TimeoutError
  );
}

export function useCreateTodoCommentChainMutationOptions({ todoId }: { todoId: number }) {
  const service = useTodoCommentService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const handleMutationError = useTodoCommentMutationErrorHandler({ todoId });

  return mutationOptions({
    mutationKey: TODO_COMMENT_MUTATION_KEYS.createCommentChain({ todoId }),
    retry: (failureCount, error) => failureCount < 2 && isRetryableTodoCommentCreationError(error),
    retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 1_000),
    mutationFn: async (input: CreateTodoCommentChainMutationParams) =>
      unwrap(await service.createCommentChain(todoId, input)),
    onSuccess: (chain) => {
      for (const comment of chain.comments) {
        trackEvent('todo_comment_created', { todo_id: todoId, depth: comment.depth });
      }
    },
    onError: (error) => {
      handleMutationError(error, 'create');
    },
    onSettled: () =>
      invalidateTodoCommentQueries({ queryClient, todoId, invalidatesTodoCount: true }),
  });
}
