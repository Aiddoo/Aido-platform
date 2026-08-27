import { useTodoCommentService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { useTodoCommentMutationError } from '../hooks/use-todo-comment-mutation-error';
import { findCommentInCache, patchCommentEverywhere } from '../utils/todo-comment-cache.util';
import { likeSettled, likeToggled } from '../utils/todo-comment-optimistic';
import {
  cancelTodoCommentQueries,
  settleTodoCommentMutation,
} from './todo-comment-mutation-lifecycle';

interface SetTodoCommentLikeVariables {
  commentId: string;
  isLiked: boolean;
}

export function useSetTodoCommentLikeMutationOptions(todoId: number) {
  const service = useTodoCommentService();
  const queryClient = useQueryClient();
  const showMutationError = useTodoCommentMutationError(todoId);

  return mutationOptions({
    mutationFn: async ({ commentId, isLiked }: SetTodoCommentLikeVariables) =>
      unwrap(await service.setCommentLike(todoId, commentId, isLiked)),
    onMutate: async ({ commentId, isLiked }) => {
      await cancelTodoCommentQueries(queryClient, todoId);
      const previous = findCommentInCache(queryClient, todoId, commentId);
      patchCommentEverywhere(queryClient, todoId, commentId, (comment) =>
        comment.viewer.isLiked === isLiked ? comment : likeToggled(comment, isLiked),
      );
      return { previous };
    },
    onError: (error, { commentId }, context) => {
      const previous = context?.previous;
      if (previous !== undefined) {
        patchCommentEverywhere(queryClient, todoId, commentId, () => previous);
      }
      showMutationError(error, 'like');
    },
    onSuccess: (result) => {
      patchCommentEverywhere(queryClient, todoId, result.commentId, (comment) =>
        likeSettled(comment, result),
      );
    },
    onSettled: () => {
      settleTodoCommentMutation(queryClient, todoId).catch(() => undefined);
    },
  });
}
