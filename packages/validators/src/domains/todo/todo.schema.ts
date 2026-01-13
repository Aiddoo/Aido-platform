/**
 * Todo 엔티티 스키마
 */
import { z } from 'zod';

export const todoSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  content: z.string().nullable(),
  completed: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Todo = z.infer<typeof todoSchema>;
