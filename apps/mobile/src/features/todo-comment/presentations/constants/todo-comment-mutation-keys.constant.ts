export const TODO_COMMENT_MUTATION_KEYS = {
  composer: (todoId: number) => ['todo-comment', todoId, 'composer-mutation'] as const,
  write: (todoId: number) => [...TODO_COMMENT_MUTATION_KEYS.composer(todoId), 'write'] as const,
  update: (todoId: number) => [...TODO_COMMENT_MUTATION_KEYS.composer(todoId), 'update'] as const,
} as const;
