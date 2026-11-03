import type { UpdateTodoCommentInput } from '@aido/api';
import { useTodoCommentService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_COMMENT_MUTATION_KEYS } from '../constants/todo-comment-mutation-keys';
import { type TodoComment, TodoCommentPolicy } from '../domains/todo-comment.model';
import { useTodoCommentMutationErrorHandler } from '../hooks/use-todo-comment-mutation-error-handler';
import {
  cancelTodoCommentQueries,
  patchTodoCommentCaches,
  restoreTodoCommentCaches,
  snapshotTodoCommentCaches,
} from './todo-comment-cache';

interface UpdateTodoCommentMutationParams {
  target: TodoComment;
  input: UpdateTodoCommentInput;
}

export function useUpdateTodoCommentMutationOptions({ todoId }: { todoId: number }) {
  const service = useTodoCommentService();
  const queryClient = useQueryClient();
  const handleMutationError = useTodoCommentMutationErrorHandler({ todoId });

  return mutationOptions({
    mutationKey: TODO_COMMENT_MUTATION_KEYS.updateComment(todoId),
    mutationFn: async ({ target, input }: UpdateTodoCommentMutationParams) =>
      unwrap(await service.updateComment(todoId, target.id, input)),
    onMutate: async ({ target, input }) => {
      await cancelTodoCommentQueries({ queryClient, todoId });
      const snapshot = snapshotTodoCommentCaches({ queryClient, todoId });
      patchTodoCommentCaches({
        queryClient,
        todoId,
        commentId: target.id,
        transform: (comment) => TodoCommentPolicy.withContentEdited(comment, input.content),
      });
      return { snapshot };
    },
    onError: (error, { target }, context) => {
      if (context != null) {
        restoreTodoCommentCaches(queryClient, context.snapshot);
      }
      handleMutationError(error, 'update', target);
    },
    onSuccess: (updated) => {
      patchTodoCommentCaches({
        queryClient,
        todoId,
        commentId: updated.id,
        transform: (comment) => ({ ...updated, replyCount: comment.replyCount }),
      });
    },
  });
}
