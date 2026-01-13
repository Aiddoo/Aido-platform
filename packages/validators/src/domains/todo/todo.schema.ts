/**
 * Todo 엔티티 스키마
 */
import { z } from 'zod';

// Todo Visibility enum
export const todoVisibilitySchema = z.enum(['PUBLIC', 'PRIVATE']);
export type TodoVisibility = z.infer<typeof todoVisibilitySchema>;

export const todoSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
  title: z.string().max(200),
  content: z.string().max(5000).nullable(),
  color: z.string().max(7).nullable(), // HEX (#FF5733)
  completed: z.boolean(),
  completedAt: z.date().nullable(),
  startDate: z.date(),
  endDate: z.date().nullable(),
  scheduledTime: z.date().nullable(),
  isAllDay: z.boolean(),
  visibility: todoVisibilitySchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Todo = z.infer<typeof todoSchema>;
