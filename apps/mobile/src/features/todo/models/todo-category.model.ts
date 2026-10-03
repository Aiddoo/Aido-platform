import { z } from 'zod';

export const todoCategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  color: z.string(),
  sortOrder: z.number(),
});
export type TodoCategory = z.infer<typeof todoCategorySchema>;

export const todoCategoryWithCountSchema = todoCategorySchema.extend({
  todoCount: z.number(),
});
export type TodoCategoryWithCount = z.infer<typeof todoCategoryWithCountSchema>;

export const todoCategoriesResultSchema = z.object({
  categories: z.array(todoCategoryWithCountSchema),
});
export type TodoCategoriesResult = z.infer<typeof todoCategoriesResultSchema>;

const optimisticTodoCategoryWithCountSchema = todoCategoryWithCountSchema.extend({
  optimistic: z.literal(true).readonly(),
});
export type OptimisticTodoCategoryWithCount = z.infer<typeof optimisticTodoCategoryWithCountSchema>;
