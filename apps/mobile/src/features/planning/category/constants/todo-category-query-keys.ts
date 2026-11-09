import { queryOptions } from '@tanstack/react-query';

import type { TodoCategoriesResult } from '../domains/todo-category.model';

export const TODO_CATEGORY_QUERY_KEYS = {
  all: ['todo-category'] as const,
  list: () =>
    queryOptions<TodoCategoriesResult>({ queryKey: [...TODO_CATEGORY_QUERY_KEYS.all, 'list'] })
      .queryKey,
} as const;
