import { useTodoCommentService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { useTodoCommentMutationErrorHandler } from '../hooks/use-todo-comment-mutation-error-handler';
import {
  withOptimisticTodoCommentLike,
  withTodoCommentLikeResult,
} from '../utils/todo-comment-cache-transforms';
import {
  cancelTodoCommentQueries,
  invalidateTodoCommentQueries,
  optimisticallyUpdateTodoCommentCaches,
  restoreTodoCommentCaches,
  updateTodoCommentCaches,
} from './todo-comment-cache';

interface SetTodoCommentLikeMutationParams {
  commentId: string;
  isLiked: boolean;
}

export function useSetTodoCommentLikeMutationOptions({ todoId }: { todoId: number }) {
  const service = useTodoCommentService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const handleMutationError = useTodoCommentMutationErrorHandler({ todoId });

  return mutationOptions({
    mutationFn: async ({ commentId, isLiked }: SetTodoCommentLikeMutationParams) =>
      unwrap(await service.setCommentLike(todoId, commentId, isLiked)),
    onMutate: async ({ commentId, isLiked }) => {
      await cancelTodoCommentQueries({ queryClient, todoId });
      const snapshot = optimisticallyUpdateTodoCommentCaches({
        queryClient,
        todoId,
        commentId,
        transform: (comment) =>
          comment.viewer.isLiked === isLiked
            ? comment
            : withOptimisticTodoCommentLike(comment, isLiked),
      });

      return { snapshot };
    },
    onError: (error, _params, context) => {
      if (context !== undefined) {
        restoreTodoCommentCaches({ queryClient, snapshot: context.snapshot });
      }
      handleMutationError(error, 'like');
    },
    onSuccess: (result) => {
      trackEvent('todo_comment_liked', { todo_id: todoId, is_liked: result.isLiked });
      updateTodoCommentCaches({
        queryClient,
        todoId,
        commentId: result.commentId,
        transform: (comment) => withTodoCommentLikeResult(comment, result),
      });
    },
    onSettled: () => invalidateTodoCommentQueries({ queryClient, todoId }),
  });
}
