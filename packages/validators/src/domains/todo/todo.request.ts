import { z } from 'zod';

import { reorderPositionSchema } from '../todo-category/todo-category.common';
import { todoVisibilitySchema } from './todo.common';

export { todoVisibilitySchema } from './todo.common';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const createTodoSchema = z
  .object({
    title: z
      .string()
      .min(1, '제목을 입력해주세요')
      .max(200, '제목은 200자 이하로 입력해주세요')
      .describe('할 일 제목 (1-200자, 예: 운동하기)'),
    content: z
      .string()
      .max(5000, '내용은 5000자 이하로 입력해주세요')
      .nullish()
      .describe('할 일 내용 (선택, 최대 5000자, 미입력 시 null)'),
    categoryId: z
      .number()
      .int()
      .positive('유효하지 않은 카테고리 ID입니다')
      .describe('카테고리 ID (양의 정수, 예: 1)'),
    startDate: z.iso
      .date('유효한 날짜 형식이 아닙니다')
      .describe('시작 날짜 (YYYY-MM-DD, 예: 2024-01-15)'),
    endDate: z.iso
      .date('유효한 날짜 형식이 아닙니다')
      .nullish()
      .describe('종료 날짜 (YYYY-MM-DD, 예: 2024-01-31, 단일 날짜는 null)'),
    scheduledTime: z
      .string()
      .regex(timeRegex, '시간 형식이 올바르지 않습니다 (HH:mm)')
      .nullish()
      .describe('예정 시간 (HH:mm 24시간 형식, 예: 15:30, 종일 일정은 null)'),
    isAllDay: z.boolean().default(true).describe('종일 일정 여부 (기본값: true)'),
    visibility: todoVisibilitySchema
      .default('PUBLIC')
      .describe('공개 범위 (PUBLIC: 전체 공개, PRIVATE: 비공개, 기본값: PUBLIC)'),
  })
  .refine(
    (data) => {
      if (data.endDate && data.startDate) {
        return new Date(data.endDate) >= new Date(data.startDate);
      }
      return true;
    },
    {
      message: '종료 날짜는 시작 날짜 이후여야 합니다',
      path: ['endDate'],
    },
  );

export type CreateTodoInput = z.infer<typeof createTodoSchema>;

export const updateTodoSchema = z
  .object({
    title: z
      .string()
      .min(1, '제목을 입력해주세요')
      .max(200, '제목은 200자 이하로 입력해주세요')
      .optional()
      .describe('할 일 제목 (선택, 1-200자)'),
    content: z
      .string()
      .max(5000, '내용은 5000자 이하로 입력해주세요')
      .nullish()
      .describe('할 일 내용 (선택, 최대 5000자)'),
    categoryId: z
      .number()
      .int()
      .positive('유효하지 않은 카테고리 ID입니다')
      .optional()
      .describe('카테고리 ID (선택, 양의 정수)'),
    startDate: z.iso
      .date('유효한 날짜 형식이 아닙니다')
      .optional()
      .describe('시작 날짜 (선택, YYYY-MM-DD)'),
    endDate: z.iso
      .date('유효한 날짜 형식이 아닙니다')
      .nullish()
      .describe('종료 날짜 (선택, YYYY-MM-DD, 단일 날짜는 null)'),
    scheduledTime: z
      .string()
      .regex(timeRegex, '시간 형식이 올바르지 않습니다 (HH:mm)')
      .nullish()
      .describe('예정 시간 (선택, HH:mm, 종일 일정은 null)'),
    isAllDay: z.boolean().optional().describe('종일 일정 여부 (선택)'),
    visibility: todoVisibilitySchema
      .optional()
      .describe('공개 범위 (선택, PUBLIC: 전체 공개, PRIVATE: 비공개)'),
    completed: z.boolean().optional().describe('완료 상태 (선택)'),
  })
  .refine(
    (data) => {
      if (data.endDate && data.startDate) {
        return new Date(data.endDate) >= new Date(data.startDate);
      }
      return true;
    },
    {
      message: '종료 날짜는 시작 날짜 이후여야 합니다',
      path: ['endDate'],
    },
  );

export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;

export const getTodosQuerySchema = z.object({
  cursor: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .describe('페이지네이션 커서 (마지막 조회 Todo ID)'),
  size: z.coerce
    .number()
    .int()
    .min(1, '페이지 크기는 1 이상이어야 합니다')
    .max(100, '페이지 크기는 100 이하여야 합니다')
    .default(20)
    .describe('페이지 크기 (1-100, 기본값: 20)'),
  completed: z
    .preprocess((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return val;
    }, z.boolean())
    .optional()
    .describe('완료 상태 필터 (선택, true/false)'),
  categoryId: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .describe('카테고리 ID 필터 (선택, 양의 정수)'),
  startDate: z.iso
    .date('유효한 날짜 형식이 아닙니다')
    .optional()
    .describe('시작 날짜 필터 (선택, YYYY-MM-DD)'),
  endDate: z.iso
    .date('유효한 날짜 형식이 아닙니다')
    .optional()
    .describe('종료 날짜 필터 (선택, YYYY-MM-DD)'),
});

export type GetTodosQuery = z.infer<typeof getTodosQuerySchema>;

export const todoIdParamSchema = z.object({
  id: z.coerce
    .number()
    .int()
    .positive('유효하지 않은 Todo ID입니다')
    .describe('할 일 고유 ID (양의 정수, 예: 1)'),
});

export type TodoIdParam = z.infer<typeof todoIdParamSchema>;

export const toggleTodoCompleteSchema = z.object({
  completed: z.boolean().describe('완료 상태 (true: 완료, false: 미완료)'),
});

export type ToggleTodoCompleteInput = z.infer<typeof toggleTodoCompleteSchema>;

export const updateTodoVisibilitySchema = z.object({
  visibility: todoVisibilitySchema.describe('공개 범위 (PUBLIC: 전체 공개, PRIVATE: 비공개)'),
});

export type UpdateTodoVisibilityInput = z.infer<typeof updateTodoVisibilitySchema>;

export const changeTodoCategorySchema = z.object({
  categoryId: z
    .number()
    .int()
    .positive('유효하지 않은 카테고리 ID입니다')
    .describe('변경할 카테고리 ID (양의 정수, 예: 1)'),
});

export type ChangeTodoCategoryInput = z.infer<typeof changeTodoCategorySchema>;

export const updateTodoScheduleSchema = z
  .object({
    startDate: z.iso
      .date('유효한 날짜 형식이 아닙니다')
      .describe('시작 날짜 (YYYY-MM-DD, 예: 2025-01-15)'),
    endDate: z.iso
      .date('유효한 날짜 형식이 아닙니다')
      .nullable()
      .optional()
      .describe('종료 날짜 (YYYY-MM-DD, 단일 날짜는 null, 예: 2025-01-31)'),
    scheduledTime: z
      .string()
      .regex(timeRegex, '시간 형식이 올바르지 않습니다 (HH:mm)')
      .nullable()
      .optional()
      .describe('예정 시간 (HH:mm 24시간 형식, 종일 일정은 null, 예: 15:30)'),
    isAllDay: z
      .boolean()
      .optional()
      .describe('종일 일정 여부 (true: 종일, false: 시간 지정, 기본값: false)'),
  })
  .refine(
    (data) => {
      if (data.endDate && data.startDate) {
        return new Date(data.endDate) >= new Date(data.startDate);
      }
      return true;
    },
    {
      message: '종료 날짜는 시작 날짜 이후여야 합니다',
      path: ['endDate'],
    },
  );

export type UpdateTodoScheduleInput = z.infer<typeof updateTodoScheduleSchema>;

export const updateTodoContentSchema = z
  .object({
    title: z
      .string()
      .min(1, '제목을 입력해주세요')
      .max(200, '제목은 200자 이하로 입력해주세요')
      .optional()
      .describe('할 일 제목 (선택, 1-200자, 예: 운동하기)'),
    content: z
      .string()
      .max(5000, '내용은 5000자 이하로 입력해주세요')
      .nullable()
      .optional()
      .describe('할 일 내용 (선택, 최대 5000자, null 허용)'),
  })
  .refine((data) => data.title !== undefined || data.content !== undefined, {
    message: '제목 또는 내용 중 하나는 입력해야 합니다',
  });

export type UpdateTodoContentInput = z.infer<typeof updateTodoContentSchema>;

export const reorderTodoSchema = z.object({
  targetTodoId: z
    .number()
    .int()
    .positive('유효하지 않은 Todo ID입니다')
    .optional()
    .describe('기준 할 일 ID (선택, 생략 시 맨 앞/뒤로 이동, 예: 123)'),
  position: reorderPositionSchema.describe('이동 위치 (before: 기준 앞으로, after: 기준 뒤로)'),
});

export type ReorderTodoInput = z.infer<typeof reorderTodoSchema>;
