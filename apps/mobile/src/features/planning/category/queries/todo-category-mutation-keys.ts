export const TODO_CATEGORY_MUTATION_KEYS = {
  all: ['todo-category', 'mutation'] as const,
  /** 카테고리 목록 캐시를 낙관적으로 고치는 뮤테이션 전부 */
  writes: () => [...TODO_CATEGORY_MUTATION_KEYS.all, 'write'] as const,
} as const;
