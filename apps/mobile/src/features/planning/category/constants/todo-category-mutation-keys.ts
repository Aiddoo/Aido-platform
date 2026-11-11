export const TODO_CATEGORY_MUTATION_KEYS = {
  /** 카테고리 목록 캐시를 낙관적으로 고치는 뮤테이션 전부 */
  writes: () => ['todo-category', 'write'] as const,
} as const;
