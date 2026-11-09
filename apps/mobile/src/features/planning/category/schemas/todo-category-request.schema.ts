import type {
  deleteTodoCategoryQuerySchema,
  reorderTodoCategorySchema,
  updateTodoCategorySchema,
} from '@aido/api';
import type { z } from 'zod';

export type TodoCategoryChange = z.infer<typeof updateTodoCategorySchema>;
export type TodoCategoryRemoval = z.infer<typeof deleteTodoCategoryQuerySchema>;
export type TodoCategoryReorder = z.infer<typeof reorderTodoCategorySchema>;
