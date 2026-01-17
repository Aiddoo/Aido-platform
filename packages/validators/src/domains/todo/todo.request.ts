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
  title: z
    .string()
    .min(1, '제목은 필수입니다')
    .max(200, '제목은 200자 이내')
    .describe('할 일 제목'),
  content: z.string().max(5000, '내용은 5000자 이내').optional().describe('할 일 내용 (선택)'),
  color: z
    .string()
    .regex(hexColorRegex, '올바른 HEX 색상 형식')
    .default(DEFAULT_TODO_COLOR)
    .describe('HEX 색상 코드 (기본값: #4A90E2)'),
  startDate: dateInputSchema.default(() => new Date()).describe('시작 날짜 (ISO 8601 형식)'),
  endDate: optionalDateInputSchema.describe('종료 날짜 (선택, ISO 8601 형식)'),
  scheduledTime: optionalDateInputSchema.describe('예약 시간 (선택, ISO 8601 형식)'),
  isAllDay: z.boolean().default(true).describe('하루 종일 여부'),
  visibility: todoVisibilitySchema.default('PUBLIC').describe('공개 범위 (PUBLIC/PRIVATE)'),
});

export type TodoCreate = z.infer<typeof todoCreateSchema>;

/** Todo 수정 스키마 */
export const todoUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional().describe('할 일 제목'),
  content: z.string().max(5000).nullable().optional().describe('할 일 내용'),
  color: z
    .string()
    .regex(hexColorRegex, '올바른 HEX 색상 형식')
    .optional()
    .describe('HEX 색상 코드'),
  completed: z.boolean().optional().describe('완료 여부'),
  startDate: optionalDateInputSchema.describe('시작 날짜 (ISO 8601 형식)'),
  endDate: nullableDateInputSchema.optional().describe('종료 날짜 (ISO 8601 형식)'),
  scheduledTime: nullableDateInputSchema.optional().describe('예약 시간 (ISO 8601 형식)'),
  isAllDay: z.boolean().optional().describe('하루 종일 여부'),
  visibility: todoVisibilitySchema.optional().describe('공개 범위 (PUBLIC/PRIVATE)'),
});

export type TodoUpdate = z.infer<typeof todoUpdateSchema>;
