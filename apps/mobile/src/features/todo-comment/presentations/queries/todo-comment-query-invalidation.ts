import { TODO_QUERY_KEYS } from '@src/features/todo/presentations/constants/todo-query-keys.constant';
import type { QueryClient } from '@tanstack/react-query';

import { TODO_COMMENT_QUERY_KEYS } from '../constants/todo-comment-query-keys.constant';

interface TodoCommentQueryParams {
  queryClient: QueryClient;
  todoId: number;
}

interface InvalidateTodoCommentQueriesParams extends TodoCommentQueryParams {
  invalidatesTodoCount?: boolean;
}

export async function cancelTodoCommentQueries({
  queryClient,
  todoId,
}: TodoCommentQueryParams): Promise<void> {
  await Promise.all([
    queryClient.cancelQueries({ queryKey: TODO_COMMENT_QUERY_KEYS.overviews(todoId) }),
    queryClient.cancelQueries({ queryKey: TODO_COMMENT_QUERY_KEYS.conversations(todoId) }),
  ]);
}

export async function invalidateTodoCommentQueries({
  queryClient,
  todoId,
  invalidatesTodoCount = false,
}: InvalidateTodoCommentQueriesParams): Promise<void> {
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

  if (invalidatesTodoCount) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.details(todoId) }),
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.lists() }),
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.friendLists() }),
    );
  }

  await Promise.all(invalidations);
}
