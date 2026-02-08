export const TODO_CATEGORY_QUERY_KEYS = {
  all: ['todo-category'] as const,
  list: () => [...TODO_CATEGORY_QUERY_KEYS.all, 'list'] as const,
} as const;
