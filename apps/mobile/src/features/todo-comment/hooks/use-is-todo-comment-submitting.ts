import { useTodoScreenParams } from '@src/features/todo/hooks/use-todo-screen-params';
import { useIsMutating } from '@tanstack/react-query';

import { TODO_COMMENT_MUTATION_KEYS } from '../constants/todo-comment-mutation-keys';

export function useIsTodoCommentSubmitting(): boolean {
  const { todoId } = useTodoScreenParams();
  return useIsMutating({ mutationKey: TODO_COMMENT_MUTATION_KEYS.submissions(todoId) }) > 0;
}
