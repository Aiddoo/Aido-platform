import { useTodoScreenParams } from '@src/features/todo/presentations/hooks/use-todo-screen-params';
import { useIsMutating } from '@tanstack/react-query';

import { TODO_COMMENT_MUTATION_KEYS } from '../constants/todo-comment-mutation-keys.constant';

export function useIsTodoCommentComposerMutating(): boolean {
  const { todoId } = useTodoScreenParams();
  const mutationCount = useIsMutating({
    mutationKey: TODO_COMMENT_MUTATION_KEYS.composer(todoId),
  });

  return mutationCount > 0;
}
