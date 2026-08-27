import { useTodoCommentService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import type { TodoComment } from '../../models/todo-comment.model';
import { useTodoCommentMutationError } from '../hooks/use-todo-comment-mutation-error';
import { settleTodoCommentMutation } from './todo-comment-mutation-lifecycle';

interface DeleteTodoCommentVariables {
  comment: TodoComment;
}

export function useDeleteTodoCommentMutationOptions(todoId: number) {
  const service = useTodoCommentService();
  const queryClient = useQueryClient();
  const showMutationError = useTodoCommentMutationError(todoId);

  return mutationOptions({
    mutationFn: async ({ comment }: DeleteTodoCommentVariables) =>
      unwrap(await service.deleteComment(todoId, comment.id)),
    onSuccess: async () => {
      await settleTodoCommentMutation(queryClient, todoId, true);
    },
    onError: (error) => {
      showMutationError(error, 'delete');
    },
  });
}
