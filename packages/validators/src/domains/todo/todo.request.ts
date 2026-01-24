/**
 * Todo 관련 요청 스키마
 * @description 할 일 생성, 수정, 조회 요청에 사용되는 Zod 스키마
 */
import { z } from 'zod';

import { todoVisibilitySchema } from './todo.common';

// Re-export for backward compatibility
export { todoVisibilitySchema } from './todo.common';

/** HEX 색상 코드 검증 */
const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

/** 시간 형식 검증 (HH:mm) */
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

// =============================================================================
// Todo 생성
// =============================================================================

export const createTodoSchema = z
  .object({
    title: z
      .string()
      .min(1, '제목을 입력해주세요')
      .max(200, '제목은 200자 이하로 입력해주세요')
      .describe('할 일 제목'),
    content: z
      .string()
      .max(5000, '내용은 5000자 이하로 입력해주세요')
      .nullish()
      .describe('할 일 상세 내용'),
    color: z
      .string()
      .regex(hexColorRegex, 'HEX 색상 코드 형식이 아닙니다 (예: #FF5733)')
      .nullish()
      .describe('색상 코드 (HEX)'),
    startDate: z.iso.date('유효한 날짜 형식이 아닙니다').describe('시작 날짜 (YYYY-MM-DD)'),
    endDate: z.iso.date('유효한 날짜 형식이 아닙니다').nullish().describe('종료 날짜 (YYYY-MM-DD)'),
    scheduledTime: z
      .string()
      .regex(timeRegex, '시간 형식이 올바르지 않습니다 (HH:mm)')
      .nullish()
      .describe('예정 시간 (HH:mm)'),
    isAllDay: z.boolean().default(true).describe('종일 여부'),
    visibility: todoVisibilitySchema
      .default('PUBLIC')
      .describe('공개 범위 (PUBLIC: 친구 공개, PRIVATE: 나만 보기)'),
  })
  .describe('할 일 생성 요청')
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

// =============================================================================
// Todo 수정
// =============================================================================

export const updateTodoSchema = z
  .object({
    title: z
      .string()
      .min(1, '제목을 입력해주세요')
      .max(200, '제목은 200자 이하로 입력해주세요')
      .optional()
      .describe('할 일 제목'),
    content: z
      .string()
      .max(5000, '내용은 5000자 이하로 입력해주세요')
      .nullish()
      .describe('할 일 상세 내용'),
    color: z
      .string()
      .regex(hexColorRegex, 'HEX 색상 코드 형식이 아닙니다 (예: #FF5733)')
      .nullish()
      .describe('색상 코드 (HEX)'),
    startDate: z.iso
      .date('유효한 날짜 형식이 아닙니다')
      .optional()
      .describe('시작 날짜 (YYYY-MM-DD)'),
    endDate: z.iso.date('유효한 날짜 형식이 아닙니다').nullish().describe('종료 날짜 (YYYY-MM-DD)'),
    scheduledTime: z
      .string()
      .regex(timeRegex, '시간 형식이 올바르지 않습니다 (HH:mm)')
      .nullish()
      .describe('예정 시간 (HH:mm)'),
    isAllDay: z.boolean().optional().describe('종일 여부'),
    visibility: todoVisibilitySchema
      .optional()
      .describe('공개 범위 (PUBLIC: 친구 공개, PRIVATE: 나만 보기)'),
    completed: z.boolean().optional().describe('완료 여부'),
  })
  .describe('할 일 수정 요청')
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

// =============================================================================
// Todo 목록 조회 (쿼리 파라미터)
// =============================================================================

export const getTodosQuerySchema = z
  .object({
    cursor: z.coerce.number().int().positive().optional().describe('페이지네이션 커서 (Todo ID)'),
    size: z.coerce
      .number()
      .int()
      .min(1, '페이지 크기는 1 이상이어야 합니다')
      .max(100, '페이지 크기는 100 이하여야 합니다')
      .default(20)
      .describe('페이지 크기'),
    completed: z
      .preprocess((val) => {
        if (val === 'true') return true;
        if (val === 'false') return false;
        return val;
      }, z.boolean())
      .optional()
      .describe('완료 상태 필터'),
    startDate: z.iso.date('유효한 날짜 형식이 아닙니다').optional().describe('시작 날짜 필터'),
    endDate: z.iso.date('유효한 날짜 형식이 아닙니다').optional().describe('종료 날짜 필터'),
  })
  .describe('할 일 목록 조회 쿼리');

export type GetTodosQuery = z.infer<typeof getTodosQuerySchema>;

// =============================================================================
// Todo ID 파라미터
// =============================================================================

export const todoIdParamSchema = z
  .object({
    id: z.coerce.number().int().positive('유효하지 않은 Todo ID입니다').describe('할 일 ID'),
  })
  .describe('할 일 ID 파라미터');

export type TodoIdParam = z.infer<typeof todoIdParamSchema>;

// =============================================================================
// Todo 액션별 수정 스키마 (SRP 기반 분리)
// =============================================================================

/**
 * 완료 상태 토글
 * @description completed 변경 시 completedAt은 서버에서 자동 관리
 */
export const toggleTodoCompleteSchema = z
  .object({
    completed: z.boolean().describe('완료 여부'),
  })
  .describe('할 일 완료 상태 토글 요청');

export type ToggleTodoCompleteInput = z.infer<typeof toggleTodoCompleteSchema>;

/**
 * 공개 범위 변경
 */
export const updateTodoVisibilitySchema = z
  .object({
    visibility: todoVisibilitySchema.describe('공개 범위 (PUBLIC: 친구 공개, PRIVATE: 나만 보기)'),
  })
  .describe('할 일 공개 범위 변경 요청');

export type UpdateTodoVisibilityInput = z.infer<typeof updateTodoVisibilitySchema>;

/**
 * 색상 변경
 * @description null을 전송하면 색상 제거
 */
export const updateTodoColorSchema = z
  .object({
    color: z
      .string()
      .regex(hexColorRegex, 'HEX 색상 코드 형식이 아닙니다 (예: #FF5733)')
      .nullable()
      .describe('색상 코드 (HEX), null이면 색상 제거'),
  })
  .describe('할 일 색상 변경 요청');

export type UpdateTodoColorInput = z.infer<typeof updateTodoColorSchema>;

/**
 * 일정 변경
 * @description startDate는 필수, 나머지는 선택
 */
export const updateTodoScheduleSchema = z
  .object({
    startDate: z.iso.date('유효한 날짜 형식이 아닙니다').describe('시작 날짜 (YYYY-MM-DD)'),
    endDate: z.iso
      .date('유효한 날짜 형식이 아닙니다')
      .nullable()
      .optional()
      .describe('종료 날짜 (YYYY-MM-DD)'),
    scheduledTime: z
      .string()
      .regex(timeRegex, '시간 형식이 올바르지 않습니다 (HH:mm)')
      .nullable()
      .optional()
      .describe('예정 시간 (HH:mm)'),
    isAllDay: z.boolean().optional().describe('종일 여부'),
  })
  .describe('할 일 일정 변경 요청')
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

/**
 * 제목/내용 수정
 * @description 최소 하나의 필드는 포함해야 함
 */
export const updateTodoContentSchema = z
  .object({
    title: z
      .string()
      .min(1, '제목을 입력해주세요')
      .max(200, '제목은 200자 이하로 입력해주세요')
      .optional()
      .describe('할 일 제목'),
    content: z
      .string()
      .max(5000, '내용은 5000자 이하로 입력해주세요')
      .nullable()
      .optional()
      .describe('할 일 상세 내용'),
  })
  .describe('할 일 제목/내용 수정 요청')
  .refine((data) => data.title !== undefined || data.content !== undefined, {
    message: '제목 또는 내용 중 하나는 입력해야 합니다',
  });

export type UpdateTodoContentInput = z.infer<typeof updateTodoContentSchema>;
