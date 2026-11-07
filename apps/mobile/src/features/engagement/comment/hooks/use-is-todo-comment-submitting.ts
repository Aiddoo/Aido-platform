import { useTodoParams } from '@src/features/planning/todo/hooks/use-todo-params';
import { useIsMutating } from '@tanstack/react-query';

import { TODO_COMMENT_MUTATION_KEYS } from '../constants/todo-comment-mutation-keys';

export function useIsTodoCommentSubmitting(): boolean {
  const { todoId } = useTodoParams();
  return useIsMutating({ mutationKey: TODO_COMMENT_MUTATION_KEYS.submissions(todoId) }) > 0;
}
