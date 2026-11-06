import {
  type deleteTodoCategoryQuerySchema,
  type reorderTodoCategorySchema,
  todoCategoryIdParamSchema,
  todoCategorySummarySchema,
  type updateTodoCategorySchema,
} from '@aido/api';
import { z } from 'zod';

export const todoCategorySchema = todoCategorySummarySchema;
export type TodoCategory = z.infer<typeof todoCategorySchema>;

export const todoCategoryIdSchema = todoCategoryIdParamSchema.shape.id;

const todoCategoryWithCountSchema = todoCategorySchema.extend({
  todoCount: z.number(),
});
export type TodoCategoryWithCount = z.infer<typeof todoCategoryWithCountSchema>;

const todoCategoriesResultSchema = z.object({
  categories: z.array(todoCategoryWithCountSchema),
});
export type TodoCategoriesResult = z.infer<typeof todoCategoriesResultSchema>;

const optimisticTodoCategoryWithCountSchema = todoCategoryWithCountSchema.extend({
  optimistic: z.literal(true).readonly(),
});
export type OptimisticTodoCategoryWithCount = z.infer<typeof optimisticTodoCategoryWithCountSchema>;

export type TodoCategoryChange = z.infer<typeof updateTodoCategorySchema>;
export type TodoCategoryRemoval = z.infer<typeof deleteTodoCategoryQuerySchema>;
export type TodoCategoryReorder = z.infer<typeof reorderTodoCategorySchema>;
