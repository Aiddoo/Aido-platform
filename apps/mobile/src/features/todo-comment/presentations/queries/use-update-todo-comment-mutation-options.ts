import type { UpdateTodoCommentInput } from '@aido/validators';
import { useTodoCommentService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_COMMENT_MUTATION_KEYS } from '../constants/todo-comment-mutation-keys.constant';
import { useTodoCommentMutationErrorHandler } from '../hooks/use-todo-comment-mutation-error-handler';
import { withEditedTodoCommentContent } from '../utils/todo-comment-cache-transforms';
import {
  optimisticallyUpdateTodoCommentCaches,
  restoreTodoCommentCaches,
  updateTodoCommentCaches,
} from './todo-comment-cache';
import {
  cancelTodoCommentQueries,
  invalidateTodoCommentQueries,
} from './todo-comment-query-invalidation';

interface UpdateTodoCommentMutationParams {
  commentId: string;
  input: UpdateTodoCommentInput;
}

export function useUpdateTodoCommentMutationOptions({ todoId }: { todoId: number }) {
  const service = useTodoCommentService();
  const queryClient = useQueryClient();
  const handleMutationError = useTodoCommentMutationErrorHandler({ todoId });

  return mutationOptions({
    mutationKey: TODO_COMMENT_MUTATION_KEYS.updateComment({ todoId }),
    mutationFn: async ({ commentId, input }: UpdateTodoCommentMutationParams) =>
      unwrap(await service.updateComment(todoId, commentId, input)),
    onMutate: async ({ commentId, input }) => {
      await cancelTodoCommentQueries({ queryClient, todoId });
      const snapshot = optimisticallyUpdateTodoCommentCaches({
        queryClient,
        todoId,
        commentId,
        transform: (comment) => withEditedTodoCommentContent(comment, input.content),
      });

      return { snapshot };
    },
    onError: (error, _params, context) => {
      if (context !== undefined) {
        restoreTodoCommentCaches({ queryClient, snapshot: context.snapshot });
      }
      handleMutationError(error, 'update');
    },
    onSuccess: (comment) => {
      updateTodoCommentCaches({
        queryClient,
        todoId,
        commentId: comment.id,
        transform: () => comment,
      });
    },
    onSettled: () => invalidateTodoCommentQueries({ queryClient, todoId }),
  });
}
