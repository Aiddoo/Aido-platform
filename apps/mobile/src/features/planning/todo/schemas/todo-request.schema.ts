import type {
  changeTodoCategorySchema,
  reorderTodoSchema,
  toggleTodoCompleteSchema,
  updateTodoScheduleSchema,
} from '@aido/api';
import type { z } from 'zod';

export type TodoCompletionChange = z.infer<typeof toggleTodoCompleteSchema>;
export type TodoCategoryMove = z.infer<typeof changeTodoCategorySchema>;
export type TodoReorder = z.infer<typeof reorderTodoSchema>;
export type TodoScheduleChange = z.infer<typeof updateTodoScheduleSchema>;
