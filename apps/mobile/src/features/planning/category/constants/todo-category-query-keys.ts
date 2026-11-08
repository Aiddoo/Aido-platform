import { queryOptions } from '@tanstack/react-query';

import type { TodoCategoriesResult } from '../domains/todo-category.model';

export const TODO_CATEGORY_QUERY_KEYS = {
  all: ['todo-category'] as const,
  // 할 일 쓰기가 개수를 직접 고쳐 데이터 타입을 붙인다
  list: () =>
    queryOptions<TodoCategoriesResult>({ queryKey: [...TODO_CATEGORY_QUERY_KEYS.all, 'list'] })
      .queryKey,
} as const;
