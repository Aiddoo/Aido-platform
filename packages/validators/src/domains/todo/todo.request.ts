/**
 * Todo Request DTO 스키마
 *
 * 날짜는 ISO 8601 문자열로 전송, Zod transform을 통해 Date 객체로 자동 변환됨
 * @see datetime.ts
 */
import { z } from 'zod';
import {
  dateInputSchema,
  nullableDateInputSchema,
  optionalDateInputSchema,
} from '../../common/datetime';
import { todoVisibilitySchema } from './todo.response';

export const DEFAULT_TODO_COLOR = '#4A90E2';

const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

/** Todo 생성 스키마 */
export const todoCreateSchema = z.object({
  title: z.string().min(1, '제목은 필수입니다').max(200, '제목은 200자 이내'),
  content: z.string().max(5000, '내용은 5000자 이내').optional(),
  color: z.string().regex(hexColorRegex, '올바른 HEX 색상 형식').default(DEFAULT_TODO_COLOR),
  startDate: dateInputSchema.default(() => new Date()),
  endDate: optionalDateInputSchema,
  scheduledTime: optionalDateInputSchema,
  isAllDay: z.boolean().default(true),
  visibility: todoVisibilitySchema.default('PUBLIC'),
});

export type TodoCreate = z.infer<typeof todoCreateSchema>;

/** Todo 수정 스키마 */
export const todoUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(5000).nullable().optional(),
  color: z.string().regex(hexColorRegex, '올바른 HEX 색상 형식').optional(),
  completed: z.boolean().optional(),
  startDate: optionalDateInputSchema,
  endDate: nullableDateInputSchema.optional(),
  scheduledTime: nullableDateInputSchema.optional(),
  isAllDay: z.boolean().optional(),
  visibility: todoVisibilitySchema.optional(),
});

export type TodoUpdate = z.infer<typeof todoUpdateSchema>;
