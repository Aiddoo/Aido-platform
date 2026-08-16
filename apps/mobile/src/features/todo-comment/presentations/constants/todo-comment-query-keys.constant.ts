import type { TodoCommentSort } from '@aido/validators';

/**
 * 최상위 댓글이든 어느 깊이의 답글이든 목록 캐시의 모양이 같아졌으므로,
 * 낙관적 업데이트는 lists 접두사 하나만 setQueriesData로 순회하면 된다.
 * 정렬과 무관한 스레드 머리말만 별도 접두사로 둔다.
 */
export const TODO_COMMENT_QUERY_KEYS = {
  all: (todoId: number) => ['todo-comment', todoId] as const,

  lists: (todoId: number) => [...TODO_COMMENT_QUERY_KEYS.all(todoId), 'list'] as const,
  /** parentId가 없으면 할 일의 최상위 댓글 목록이다. */
  commentsBySort: (todoId: number, parentId: string | null, sort: TodoCommentSort) =>
    [...TODO_COMMENT_QUERY_KEYS.lists(todoId), parentId ?? 'root', sort] as const,

  threads: (todoId: number) => [...TODO_COMMENT_QUERY_KEYS.all(todoId), 'thread'] as const,
  thread: (todoId: number, commentId: string) =>
    [...TODO_COMMENT_QUERY_KEYS.threads(todoId), commentId] as const,
} as const;
