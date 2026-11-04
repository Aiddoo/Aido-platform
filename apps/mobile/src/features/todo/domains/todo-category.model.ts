import { todoCategorySummarySchema } from '@aido/api';
import { z } from 'zod';

export const todoCategorySchema = todoCategorySummarySchema;
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
