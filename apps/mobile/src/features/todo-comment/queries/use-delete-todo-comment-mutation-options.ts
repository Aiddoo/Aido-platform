import { useTodoCommentService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { useTodoCommentMutationErrorHandler } from '../hooks/use-todo-comment-mutation-error-handler';
import { findCachedTodoComment } from './todo-comment-cache';
import { invalidateTodoCommentQueries } from './todo-comment-query-invalidation';

interface DeleteTodoCommentMutationParams {
  commentId: string;
}

export function useDeleteTodoCommentMutationOptions({ todoId }: { todoId: number }) {
  const service = useTodoCommentService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const handleMutationError = useTodoCommentMutationErrorHandler({ todoId });

  return mutationOptions({
    mutationFn: async ({ commentId }: DeleteTodoCommentMutationParams) =>
      unwrap(await service.deleteComment(todoId, commentId)),
    onMutate: ({ commentId }) => ({
      depth: findCachedTodoComment({ queryClient, todoId, commentId })?.depth,
    }),
    onSuccess: (_result, _variables, context) => {
      if (context?.depth != null) {
        trackEvent('todo_comment_deleted', { todo_id: todoId, depth: context.depth });
      }
    },
    onError: (error) => {
      handleMutationError(error, 'delete');
    },
    onSettled: () =>
      invalidateTodoCommentQueries({ queryClient, todoId, invalidatesTodoCount: true }),
  });
}
