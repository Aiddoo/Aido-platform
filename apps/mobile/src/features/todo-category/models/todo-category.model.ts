import { z } from 'zod';

// ============================================================
// TodoCategory 도메인 스키마 (프론트엔드 전용)
// ============================================================

/** 카테고리 아이템 - 프론트엔드 도메인 모델 */
export const todoCategoryItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  color: z.string(),
  sortOrder: z.number(),
  todoCount: z.number().optional(),
});
export type TodoCategoryItem = z.infer<typeof todoCategoryItemSchema>;

/** 카테고리 목록 조회 결과 */
export const todoCategoriesResultSchema = z.object({
  categories: z.array(todoCategoryItemSchema),
});
export type TodoCategoriesResult = z.infer<typeof todoCategoriesResultSchema>;

// ============================================================
// Policy (비즈니스 규칙)
// ============================================================

/** TodoCategory Policy (비즈니스 규칙) */
export const TodoCategoryPolicy = {
  /** 기본 카테고리 이름 */
  DEFAULT_CATEGORY_NAME: '할 일',

  /** 기본 카테고리 찾기 */
  getDefaultCategory: (categories: TodoCategoryItem[]): TodoCategoryItem | undefined =>
    categories.find((c) => c.name === TodoCategoryPolicy.DEFAULT_CATEGORY_NAME) || categories[0],
} as const;
