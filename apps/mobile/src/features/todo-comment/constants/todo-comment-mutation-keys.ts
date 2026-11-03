export const TODO_COMMENT_MUTATION_KEYS = {
  submissions: (todoId: number) => ['todo-comment', todoId, 'submission'] as const,
  createCommentChain: (todoId: number) =>
    [...TODO_COMMENT_MUTATION_KEYS.submissions(todoId), 'create-comment-chain'] as const,
  updateComment: (todoId: number) =>
    [...TODO_COMMENT_MUTATION_KEYS.submissions(todoId), 'update-comment'] as const,
} as const;
