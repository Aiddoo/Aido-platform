export const TODO_COMMENT_MUTATION_KEYS = {
  submissions: (todoId: number) => ['todo-comment', todoId, 'submission'] as const,
  createCommentChain: (todoId: number) =>
    [...TODO_COMMENT_MUTATION_KEYS.submissions(todoId), 'create-comment-chain'] as const,
  updateComment: (todoId: number) =>
    [...TODO_COMMENT_MUTATION_KEYS.submissions(todoId), 'update-comment'] as const,
  /** 댓글 목록을 낙관적으로 고치는 지우기·하트 */
  writes: (todoId: number) => ['todo-comment', todoId, 'write'] as const,
  deleteComment: (todoId: number) =>
    [...TODO_COMMENT_MUTATION_KEYS.writes(todoId), 'delete-comment'] as const,
  likeComment: ({ todoId, commentId }: { todoId: number; commentId: string }) =>
    [...TODO_COMMENT_MUTATION_KEYS.writes(todoId), 'like-comment', commentId] as const,
} as const;
