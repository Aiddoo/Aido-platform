export const TODO_COMMENT_MUTATION_KEYS = {
  submissions: ({ todoId }: { todoId: number }) => ['todo-comment', todoId, 'submission'] as const,
  createCommentChain: ({ todoId }: { todoId: number }) =>
    [...TODO_COMMENT_MUTATION_KEYS.submissions({ todoId }), 'create-comment-chain'] as const,
  updateComment: ({ todoId }: { todoId: number }) =>
    [...TODO_COMMENT_MUTATION_KEYS.submissions({ todoId }), 'update-comment'] as const,
} as const;
