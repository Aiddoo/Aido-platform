export const TODO_COMMENT_MUTATION_KEYS = {
  all: ['todo-comment', 'mutation'] as const,
  submissions: ({ todoId }: { todoId: number }) =>
    [...TODO_COMMENT_MUTATION_KEYS.all, { todoId }, 'submission'] as const,
  createCommentChain: ({ todoId }: { todoId: number }) =>
    [...TODO_COMMENT_MUTATION_KEYS.submissions({ todoId }), 'create-comment-chain'] as const,
  updateComment: ({ todoId }: { todoId: number }) =>
    [...TODO_COMMENT_MUTATION_KEYS.submissions({ todoId }), 'update-comment'] as const,
  /** 댓글 목록을 낙관적으로 고치는 지우기·하트 */
  writes: ({ todoId }: { todoId: number }) =>
    [...TODO_COMMENT_MUTATION_KEYS.all, { todoId }, 'write'] as const,
  deleteComment: ({ todoId }: { todoId: number }) =>
    [...TODO_COMMENT_MUTATION_KEYS.writes({ todoId }), 'delete-comment'] as const,
  likeComment: ({ todoId, commentId }: { todoId: number; commentId: string }) =>
    [...TODO_COMMENT_MUTATION_KEYS.writes({ todoId }), 'like-comment', { commentId }] as const,
} as const;
