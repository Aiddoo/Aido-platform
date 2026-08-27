import type { TodoCommentSort } from '@aido/validators';

export const TODO_COMMENT_QUERY_TIMING = {
  latestStaleTime: 30_000,
  popularStaleTime: 10_000,
  gcTime: 30 * 60_000,
} as const;

export const TODO_COMMENT_QUERY_KEYS = {
  all: (todoId: number) => ['todo-comment', todoId] as const,
  overviews: (todoId: number) => [...TODO_COMMENT_QUERY_KEYS.all(todoId), 'overview'] as const,
  overview: ({ todoId, sort }: { todoId: number; sort: TodoCommentSort }) =>
    [...TODO_COMMENT_QUERY_KEYS.overviews(todoId), { sort }] as const,
  conversations: (todoId: number) =>
    [...TODO_COMMENT_QUERY_KEYS.all(todoId), 'conversation'] as const,
  conversation: ({
    todoId,
    sort,
    focusCommentId,
  }: {
    todoId: number;
    sort: TodoCommentSort;
    focusCommentId?: string;
  }) =>
    [
      ...TODO_COMMENT_QUERY_KEYS.conversations(todoId),
      { sort, focusCommentId: focusCommentId ?? null },
    ] as const,
} as const;
