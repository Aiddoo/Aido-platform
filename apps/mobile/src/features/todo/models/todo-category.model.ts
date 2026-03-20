import { z } from 'zod';

// 기본 모델 (생성/수정 응답)
export const todoCategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  color: z.string(),
  sortOrder: z.number(),
});
export type TodoCategory = z.infer<typeof todoCategorySchema>;

// 목록 조회용 (todoCount 포함)
export const todoCategoryWithCountSchema = todoCategorySchema.extend({
  todoCount: z.number(),
});
export type TodoCategoryWithCount = z.infer<typeof todoCategoryWithCountSchema>;

// 목록 결과
export const todoCategoriesResultSchema = z.object({
  categories: z.array(todoCategoryWithCountSchema),
});
export type TodoCategoriesResult = z.infer<typeof todoCategoriesResultSchema>;

// Optimistic Update용 타입
export type OptimisticTodoCategoryWithCount = TodoCategoryWithCount & {
  readonly optimistic: true;
};
