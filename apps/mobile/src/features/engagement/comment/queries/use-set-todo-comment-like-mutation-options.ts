import { useTodoCommentService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TodoCommentPolicy } from '../domains/todo-comment.model';
import { useTodoCommentMutationErrorHandler } from '../hooks/use-todo-comment-mutation-error-handler';
import {
  cancelTodoCommentQueries,
  findCachedTodoComment,
  patchTodoCommentCaches,
  restoreTodoCommentCaches,
  snapshotTodoCommentCaches,
} from './todo-comment-cache';

export type TodoCommentLikeVia = 'button' | 'double_tap';

interface SetTodoCommentLikeMutationParams {
  isLiked: boolean;
  via: TodoCommentLikeVia;
}

/** 같은 댓글의 연타는 scope로 차례대로 보낸다. 다른 댓글과 목록은 다시 받지 않는다 */
export function useSetTodoCommentLikeMutationOptions({
  todoId,
  commentId,
}: {
  todoId: number;
  commentId: string;
}) {
  const service = useTodoCommentService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const handleMutationError = useTodoCommentMutationErrorHandler({ todoId });

  return mutationOptions({
    scope: { id: `todo-comment-like:${commentId}` },
    mutationFn: async ({ isLiked }: SetTodoCommentLikeMutationParams) =>
      unwrap(await service.setCommentLike(todoId, commentId, isLiked)),
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
