import { useTodoCommentService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { type TodoComment, TodoCommentPolicy } from '../domains/todo-comment.model';
import { useTodoCommentMutationErrorHandler } from '../hooks/use-todo-comment-mutation-error-handler';
import {
  cancelTodoCommentQueries,
  invalidateTodoCommentCount,
  removeTodoCommentFromCaches,
  restoreTodoCommentCaches,
  snapshotTodoCommentCaches,
} from './todo-comment-cache';

interface DeleteTodoCommentMutationParams {
  comment: TodoComment;
}

/** 지우면 행을 먼저 빼고, 실패하면 지우기 전 캐시로 되돌린다 */
export function useDeleteTodoCommentMutationOptions({ todoId }: { todoId: number }) {
  const service = useTodoCommentService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const handleMutationError = useTodoCommentMutationErrorHandler({ todoId });

  return mutationOptions({
    mutationFn: async ({ comment }: DeleteTodoCommentMutationParams) =>
      unwrap(await service.deleteComment(todoId, comment.id)),
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
