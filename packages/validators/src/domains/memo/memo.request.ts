import { z } from 'zod';
import { todoVisibilitySchema } from '../todo/todo.common';
import { TODO_ITEM_LIMITS } from '../todo/todo.constants';
import { reorderPositionSchema } from '../todo-category/todo-category.common';
import { MEMO_LIMITS } from './memo.constants';

export const createMemoSchema = z.object({
  content: z
    .string()
    .min(1, '메모 내용을 입력해주세요')
    .max(
      MEMO_LIMITS.MAX_CONTENT_LENGTH,
      `메모는 ${MEMO_LIMITS.MAX_CONTENT_LENGTH}자 이내여야 합니다`,
    )
    .describe(`메모 내용 (1-${MEMO_LIMITS.MAX_CONTENT_LENGTH}자)`),
});

export type CreateMemoInput = z.infer<typeof createMemoSchema>;

export const updateMemoSchema = z.object({
  content: z
    .string()
    .min(1, '메모 내용을 입력해주세요')
    .max(
      MEMO_LIMITS.MAX_CONTENT_LENGTH,
      `메모는 ${MEMO_LIMITS.MAX_CONTENT_LENGTH}자 이내여야 합니다`,
    )
    .describe(`메모 내용 (1-${MEMO_LIMITS.MAX_CONTENT_LENGTH}자)`),
});

export type UpdateMemoInput = z.infer<typeof updateMemoSchema>;

export const getMemosQuerySchema = z.object({
  cursor: z.coerce
    .number()
    .int()
    .nonnegative('유효하지 않은 커서입니다')
    .optional()
    .describe('페이지네이션 커서 (0 이상의 정수)'),
  size: z.coerce
    .number()
    .int()
    .min(1, '최소 1개 이상 조회해야 합니다')
    .max(200, '최대 200개까지 조회 가능합니다')
    .default(20)
    .describe('조회할 개수 (1-200, 기본값: 20)'),
});

export type GetMemosQuery = z.infer<typeof getMemosQuerySchema>;

export const memoIdParamSchema = z.object({
  id: z.coerce
    .number()
    .int()
    .positive('유효하지 않은 메모 ID입니다')
    .describe('메모 고유 ID (양의 정수, 예: 1)'),
});

export type MemoIdParam = z.infer<typeof memoIdParamSchema>;

export const toggleMemoPinSchema = z.object({
  isPinned: z.boolean().describe('고정 여부 (true: 고정, false: 해제)'),
});

export type ToggleMemoPinInput = z.infer<typeof toggleMemoPinSchema>;

export const reorderMemoSchema = z.object({
  targetMemoId: z
    .number()
    .int()
    .positive('유효하지 않은 메모 ID입니다')
    .optional()
    .describe('기준 메모 ID (선택, 생략 시 맨 앞/뒤로 이동, 예: 123)'),
  position: reorderPositionSchema.describe('이동 위치 (before: 기준 앞으로, after: 기준 뒤로)'),
});

export type ReorderMemoInput = z.infer<typeof reorderMemoSchema>;

export const convertMemoToTodoSchema = z.object({
  categoryId: z
    .number()
    .int()
    .positive('유효하지 않은 카테고리 ID입니다')
    .describe('카테고리 ID (양의 정수)'),
  startDate: z.iso.date().describe('시작 날짜 (YYYY-MM-DD, 예: 2026-01-15)'),
  endDate: z.iso.date().optional().describe('종료 날짜 (YYYY-MM-DD, 선택)'),
  scheduledTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'HH:mm 형식이어야 합니다')
    .optional()
    .describe('예정 시간 (HH:mm, 24시간 형식, 선택)'),
  isAllDay: z.boolean().default(true).describe('종일 여부 (기본값: true)'),
  visibility: todoVisibilitySchema
    .default('PUBLIC')
    .describe('공개 범위 (PUBLIC/PRIVATE, 기본값: PUBLIC)'),
  items: z
    .array(
      z.object({
        title: z
          .string()
          .min(1, '제목을 입력해주세요')
          .max(200, '제목은 200자 이하로 입력해주세요')
          .describe('하위 항목 제목'),
      }),
    )
    .max(
      TODO_ITEM_LIMITS.MAX_PER_TODO,
      `하위 항목은 최대 ${TODO_ITEM_LIMITS.MAX_PER_TODO}개까지 추가할 수 있습니다`,
    )
    .optional()
    .describe('할 일 생성 시 함께 만들 체크리스트 (선택, 최대 20개)'),
});

export type ConvertMemoToTodoInput = z.infer<typeof convertMemoToTodoSchema>;
