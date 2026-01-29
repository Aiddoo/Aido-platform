/** TodoCategory 쿼리 키 팩토리 */
export const todoCategoryQueryKeys = {
  all: ['todo-categories'] as const,
  lists: () => [...todoCategoryQueryKeys.all, 'list'] as const,
  list: () => [...todoCategoryQueryKeys.lists()] as const,
} as const;
