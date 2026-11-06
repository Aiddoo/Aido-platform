import { z } from 'zod';

export const subTodoSchema = z.object({
  id: z.number(),
  title: z.string(),
  completed: z.boolean(),
  sortOrder: z.number(),
});
export type SubTodo = z.infer<typeof subTodoSchema>;

export const subTodoStatsSchema = z.object({
  total: z.number(),
  completed: z.number(),
});
export type SubTodoStats = z.infer<typeof subTodoStatsSchema>;
