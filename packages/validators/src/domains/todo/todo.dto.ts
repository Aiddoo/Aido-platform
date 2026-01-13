/**
 * Todo Request DTO 스키마
 */
import { z } from 'zod';

export const todoCreateSchema = z.object({
  title: z.string().min(1, '제목은 필수입니다').max(100, '제목은 100자를 초과할 수 없습니다'),
  content: z.string().max(500, '내용은 500자를 초과할 수 없습니다').optional(),
});

export type TodoCreate = z.infer<typeof todoCreateSchema>;

export const todoUpdateSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  content: z.string().max(500).optional(),
  completed: z.boolean().optional(),
});

export type TodoUpdate = z.infer<typeof todoUpdateSchema>;
