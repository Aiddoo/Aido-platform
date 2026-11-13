import { queryOptions } from '@tanstack/react-query';

import type { TodoCategoryDeletionPreview } from '../domains/todo-category-deletion.model';
import type { TodoCategoriesResult } from '../domains/todo-category.model';

export const TODO_CATEGORY_QUERY_KEYS = {
  all: ['todo-category'] as const,
  list: () =>
    queryOptions<TodoCategoriesResult>({ queryKey: [...TODO_CATEGORY_QUERY_KEYS.all, 'list'] })
      .queryKey,
  // 삭제를 누를 때마다 버리고 다시 받는다. all 밖에 두어 지운 뒤 목록을 다시 받을 때 지운 카테고리를 다시 묻지 않는다
  deletionPreview: ({ categoryId }: { categoryId: number }) =>
    queryOptions<TodoCategoryDeletionPreview>({
      queryKey: ['todo-category-deletion-preview', { categoryId }],
    }).queryKey,
} as const;
