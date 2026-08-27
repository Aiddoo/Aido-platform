import { TODO_QUERY_KEYS } from '@src/features/todo/presentations/constants/todo-query-keys.constant';
import type { QueryClient } from '@tanstack/react-query';

import { TODO_COMMENT_QUERY_KEYS } from '../constants/todo-comment-query-keys.constant';

export async function cancelTodoCommentQueries(queryClient: QueryClient, todoId: number) {
  await Promise.all([
    queryClient.cancelQueries({ queryKey: TODO_COMMENT_QUERY_KEYS.overviews(todoId) }),
    queryClient.cancelQueries({ queryKey: TODO_COMMENT_QUERY_KEYS.conversations(todoId) }),
  ]);
}

export async function settleTodoCommentMutation(
  queryClient: QueryClient,
  todoId: number,
  touchesTodoCount = false,
) {
  const invalidations = [
    queryClient.invalidateQueries({
      queryKey: TODO_COMMENT_QUERY_KEYS.overviews(todoId),
      refetchType: 'active',
    }),
    queryClient.invalidateQueries({
      queryKey: TODO_COMMENT_QUERY_KEYS.conversations(todoId),
      refetchType: 'active',
    }),
  ];

  if (touchesTodoCount) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.details(todoId) }),
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.lists() }),
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.friendLists() }),
    );
  }

  await Promise.all(invalidations);
}
