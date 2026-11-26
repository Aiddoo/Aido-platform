import { z } from 'zod';

import type { TodoCategoryDeletionResult } from './todo-category-deletion.model';
import { type TodoCategory, todoCategorySchema } from './todo-category.model';

export const todoCategoryWithCountSchema = todoCategorySchema.extend({
  todoCount: z.number(),
});
export type TodoCategoryWithCount = z.infer<typeof todoCategoryWithCountSchema>;

// 내 카테고리 목록. 카테고리마다 서버가 센 할 일 수가 붙는다
export const todoCategoriesResultSchema = z.object({
  categories: z.array(todoCategoryWithCountSchema),
});
export type TodoCategoriesResult = z.infer<typeof todoCategoriesResultSchema>;

export type FilterTodoCategory = (category: TodoCategoryWithCount) => boolean;

// 쓰기 응답으로 받은 목록을 고친다. 목록에서 카테고리를 찾고 고르는 규칙은 TodoCategoryPolicy에 있다
export const TodoCategoriesPolicy = {
  withCategoryAdded(
    result: TodoCategoriesResult,
    category: TodoCategoryWithCount,
  ): TodoCategoriesResult {
    return { ...result, categories: [...result.categories, category] };
  },

  // 그사이 다시 받아 임시 행이 사라졌으면 서버 행이 없을 때만 끝에 붙인다
  withCategorySaved(
    result: TodoCategoriesResult,
    optimisticCategoryId: number,
    savedCategory: TodoCategory,
  ): TodoCategoriesResult {
    if (result.categories.some(({ id }) => id === optimisticCategoryId)) {
      return {
        ...result,
        categories: result.categories.map((category) =>
          category.id === optimisticCategoryId
            ? { ...savedCategory, todoCount: category.todoCount }
            : category,
        ),
      };
    }
    if (result.categories.some(({ id }) => id === savedCategory.id)) {
      return result;
    }
    return this.withCategoryAdded(result, { ...savedCategory, todoCount: 0 });
  },

  withCategoryRemoved(result: TodoCategoriesResult, categoryId: number): TodoCategoriesResult {
    return { ...result, categories: result.categories.filter(({ id }) => id !== categoryId) };
  },

  withCategoryChanged(
    result: TodoCategoriesResult,
    categoryId: number,
    change: Partial<Pick<TodoCategory, 'name' | 'color'>>,
  ): TodoCategoriesResult {
    return {
      ...result,
      categories: result.categories.map((category) =>
        category.id === categoryId ? { ...category, ...change } : category,
      ),
    };
  },

  // 할 일을 만들거나 지운 만큼 그 카테고리의 개수만 바꾼다. 개수는 서버가 세는 카테고리의 할 일 수와 같다
  withTodoCountChanged(
    result: TodoCategoriesResult,
    categoryId: number,
    delta: number,
  ): TodoCategoriesResult {
    return {
      ...result,
      categories: result.categories.map((category) =>
        category.id === categoryId
          ? { ...category, todoCount: Math.max(0, category.todoCount + delta) }
          : category,
      ),
    };
  },

  // 지운 카테고리를 빼고, 옮겼으면 옮긴 곳에 옮긴 할 일 수를 더한다
  withCategoryDeleted(
    result: TodoCategoriesResult,
    categoryId: number,
    deletionResult: TodoCategoryDeletionResult,
  ): TodoCategoriesResult {
    const remaining = this.withCategoryRemoved(result, categoryId);

    if (deletionResult.todoHandling !== 'move' || deletionResult.moveToCategoryId == null) {
      return remaining;
    }

    return this.withTodoCountChanged(
      remaining,
      deletionResult.moveToCategoryId,
      deletionResult.todoCount,
    );
  },
};
