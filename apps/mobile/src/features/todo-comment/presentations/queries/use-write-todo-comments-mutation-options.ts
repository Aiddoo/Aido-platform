import type { CreateTodoCommentChainInput } from '@aido/validators';
import { useTodoCommentService } from '@src/bootstrap/providers/di-context';
import { NetworkError, ServerError, TimeoutError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_COMMENT_MUTATION_KEYS } from '../constants/todo-comment-mutation-keys.constant';
import { useTodoCommentMutationError } from '../hooks/use-todo-comment-mutation-error';
import { settleTodoCommentMutation } from './todo-comment-mutation-lifecycle';

function isRetryableWriteError(error: unknown): error is NetworkError | ServerError | TimeoutError {
  return (
    error instanceof NetworkError || error instanceof ServerError || error instanceof TimeoutError
  );
}

export function useWriteTodoCommentsMutationOptions(todoId: number) {
  const service = useTodoCommentService();
  const queryClient = useQueryClient();
  const showMutationError = useTodoCommentMutationError(todoId);

  return mutationOptions({
    mutationKey: TODO_COMMENT_MUTATION_KEYS.write(todoId),
    retry: (failureCount, error) => failureCount < 2 && isRetryableWriteError(error),
    retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 1_000),
    mutationFn: async ({ parentId, items }: CreateTodoCommentChainInput) =>
      unwrap(await service.writeComments(todoId, { parentId, items })),
    onSuccess: async () => {
      await settleTodoCommentMutation(queryClient, todoId, true);
    },
    onError: (error) => {
      showMutationError(error, 'write');
    },
  });
}
