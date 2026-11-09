import type { TodoCommentSort } from '@aido/api/vocabulary';

export const TODO_COMMENT_QUERY_KEYS = {
  all: ['todo-comment'] as const,
  todo: ({ todoId }: { todoId: number }) => [...TODO_COMMENT_QUERY_KEYS.all, { todoId }] as const,
  threadLists: ({ todoId }: { todoId: number }) =>
    [...TODO_COMMENT_QUERY_KEYS.todo({ todoId }), 'threads'] as const,
  threads: ({
    todoId,
    sort,
    anchorCommentId,
  }: {
    todoId: number;
    sort: TodoCommentSort;
    anchorCommentId: string | null;
  }) => [...TODO_COMMENT_QUERY_KEYS.threadLists({ todoId }), { sort, anchorCommentId }] as const,
  replyLists: ({ todoId }: { todoId: number }) =>
    [...TODO_COMMENT_QUERY_KEYS.todo({ todoId }), 'replies'] as const,
  threadReplies: ({ todoId, commentId }: { todoId: number; commentId: string }) =>
    [...TODO_COMMENT_QUERY_KEYS.replyLists({ todoId }), { commentId }] as const,
  replies: ({
    todoId,
    commentId,
    aroundReplyId,
  }: {
    todoId: number;
    commentId: string;
    aroundReplyId: string | null;
  }) =>
    [...TODO_COMMENT_QUERY_KEYS.threadReplies({ todoId, commentId }), { aroundReplyId }] as const,
} as const;
