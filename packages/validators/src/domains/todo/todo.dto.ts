/**
 * Todo Request DTO 스키마
 */
import { z } from 'zod';
import { todoVisibilitySchema } from './todo.schema';

// 기본 색상 (연한 파란색)
export const DEFAULT_TODO_COLOR = '#4A90E2';

export const todoCreateSchema = z.object({
  title: z.string().min(1, '제목은 필수입니다').max(200, '제목은 200자를 초과할 수 없습니다'),
  content: z.string().max(5000, '내용은 5000자를 초과할 수 없습니다').optional(),
  color: z
    .string()
    .max(7)
    .regex(/^#[0-9A-Fa-f]{6}$/, '올바른 HEX 색상 형식이 아닙니다')
    .default(DEFAULT_TODO_COLOR),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  scheduledTime: z.coerce.date().optional(),
  isAllDay: z.boolean().default(true),
  visibility: todoVisibilitySchema.default('PUBLIC'),
});

export type TodoCreate = z.infer<typeof todoCreateSchema>;

export const todoUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(5000).optional(),
  color: z
    .string()
    .max(7)
    .regex(/^#[0-9A-Fa-f]{6}$/, '올바른 HEX 색상 형식이 아닙니다')
    .optional(),
  completed: z.boolean().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().nullable().optional(),
  scheduledTime: z.coerce.date().nullable().optional(),
  isAllDay: z.boolean().optional(),
  visibility: todoVisibilitySchema.optional(),
});

export type TodoUpdate = z.infer<typeof todoUpdateSchema>;
