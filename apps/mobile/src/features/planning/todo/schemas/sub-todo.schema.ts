import { todoItemResponseSchema, todoItemStatsSchema } from '@aido/api';
import type { z } from 'zod';

/** 서버의 하위 항목(`items`)에서 앱이 쓰는 칸만 고른다 */
export const subTodoSchema = todoItemResponseSchema.pick({
  id: true,
  title: true,
  completed: true,
  sortOrder: true,
});
export type SubTodo = z.infer<typeof subTodoSchema>;

export const subTodoStatsSchema = todoItemStatsSchema.pick({ total: true, completed: true });
export type SubTodoStats = z.infer<typeof subTodoStatsSchema>;
