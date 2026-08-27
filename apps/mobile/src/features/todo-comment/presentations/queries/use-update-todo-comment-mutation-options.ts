import type { UpdateTodoCommentInput } from '@aido/validators';
import { useTodoCommentService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_COMMENT_MUTATION_KEYS } from '../constants/todo-comment-mutation-keys.constant';
import { useTodoCommentMutationError } from '../hooks/use-todo-comment-mutation-error';
import { findCommentInCache, patchCommentEverywhere } from '../utils/todo-comment-cache.util';
import { contentEdited } from '../utils/todo-comment-optimistic';
import {
  cancelTodoCommentQueries,
  settleTodoCommentMutation,
} from './todo-comment-mutation-lifecycle';

interface UpdateTodoCommentVariables {
  commentId: string;
  input: UpdateTodoCommentInput;
}

export function useUpdateTodoCommentMutationOptions(todoId: number) {
  const service = useTodoCommentService();
  const queryClient = useQueryClient();
  const showMutationError = useTodoCommentMutationError(todoId);

  return mutationOptions({
    mutationKey: TODO_COMMENT_MUTATION_KEYS.update(todoId),
    mutationFn: async ({ commentId, input }: UpdateTodoCommentVariables) =>
      unwrap(await service.updateComment(todoId, commentId, input)),
    onMutate: async ({ commentId, input }) => {
      await cancelTodoCommentQueries(queryClient, todoId);
      const previous = findCommentInCache(queryClient, todoId, commentId);
      patchCommentEverywhere(queryClient, todoId, commentId, (comment) =>
        contentEdited(comment, input.content),
      );
      return { previous };
    },
    onError: (error, { commentId }, context) => {
      const previous = context?.previous;
      if (previous !== undefined) {
        patchCommentEverywhere(queryClient, todoId, commentId, () => previous);
      }
      showMutationError(error, 'update');
    },
    onSuccess: (comment) => {
      patchCommentEverywhere(queryClient, todoId, comment.id, () => comment);
    },
    onSettled: () => {
      settleTodoCommentMutation(queryClient, todoId).catch(() => undefined);
    },
  });
}
