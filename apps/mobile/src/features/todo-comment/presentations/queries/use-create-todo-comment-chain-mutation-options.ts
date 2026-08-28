import type { CreateTodoCommentChainInput } from '@aido/validators';
import { useTodoCommentService } from '@src/bootstrap/providers/di-context';
import { NetworkError, ServerError, TimeoutError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_COMMENT_MUTATION_KEYS } from '../constants/todo-comment-mutation-keys.constant';
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
  const handleMutationError = useTodoCommentMutationErrorHandler({ todoId });

  return mutationOptions({
    mutationKey: TODO_COMMENT_MUTATION_KEYS.createCommentChain({ todoId }),
    retry: (failureCount, error) => failureCount < 2 && isRetryableTodoCommentCreationError(error),
    retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 1_000),
    mutationFn: async (input: CreateTodoCommentChainMutationParams) =>
      unwrap(await service.createCommentChain(todoId, input)),
    onError: (error) => {
      handleMutationError(error, 'create');
    },
    onSettled: () =>
      invalidateTodoCommentQueries({ queryClient, todoId, invalidatesTodoCount: true }),
  });
}
