import { useTodoCommentService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { useTodoCommentMutationErrorHandler } from '../hooks/use-todo-comment-mutation-error-handler';
import { invalidateTodoCommentQueries } from './todo-comment-query-invalidation';

interface DeleteTodoCommentMutationParams {
  commentId: string;
}

export function useDeleteTodoCommentMutationOptions({ todoId }: { todoId: number }) {
  const service = useTodoCommentService();
  const queryClient = useQueryClient();
  const handleMutationError = useTodoCommentMutationErrorHandler({ todoId });

  return mutationOptions({
    mutationFn: async ({ commentId }: DeleteTodoCommentMutationParams) =>
      unwrap(await service.deleteComment(todoId, commentId)),
    onError: (error) => {
      handleMutationError(error, 'delete');
    },
    onSettled: () =>
      invalidateTodoCommentQueries({ queryClient, todoId, invalidatesTodoCount: true }),
  });
}
