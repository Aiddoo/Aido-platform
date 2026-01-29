import { z } from 'zod';

// ============================================================
// Enum Schemas
// ============================================================

/** Todo 공개 범위 */
export const todoVisibilitySchema = z.enum(['PUBLIC', 'PRIVATE']);
export type TodoVisibility = z.infer<typeof todoVisibilitySchema>;

// ============================================================
// Category 스키마
// ============================================================

/** 카테고리 요약 정보 */
export const todoCategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  color: z.string(),
});
export type TodoCategory = z.infer<typeof todoCategorySchema>;

// ============================================================
// Todo 도메인 스키마 (프론트엔드 전용)
// ============================================================

/** Todo 아이템 - 프론트엔드 도메인 모델 */
export const todoItemSchema = z.object({
  id: z.number(),
  title: z.string(),
  category: todoCategorySchema,
  completed: z.boolean(),
  scheduledTime: z.date().nullable(), // Date 객체 (서버는 string)
  isAllDay: z.boolean(),
  visibility: todoVisibilitySchema,
});
export type TodoItem = z.infer<typeof todoItemSchema>;

/** 날짜별 Todo 목록 */
export const todosByDateSchema = z.object({
  date: z.string(), // YYYY-MM-DD
  todos: z.array(todoItemSchema),
});
export type TodosByDate = z.infer<typeof todosByDateSchema>;

/** Todo 목록 조회 결과 (페이지네이션 포함) */
export const todosResultSchema = z.object({
  todos: z.array(todoItemSchema),
  hasNext: z.boolean(),
  nextCursor: z.number().nullable(),
});
export type TodosResult = z.infer<typeof todosResultSchema>;

// ============================================================
// AI 파싱 도메인 스키마 (프론트엔드 전용)
// ============================================================

/** 파싱된 Todo 데이터 - 프론트엔드 도메인 모델 */
export const parsedTodoDataSchema = z.object({
  title: z.string(),
  startDate: z.string(), // YYYY-MM-DD
  endDate: z.string().nullable(),
  scheduledTime: z.string().nullable(), // HH:mm
  isAllDay: z.boolean(),
});
export type ParsedTodoData = z.infer<typeof parsedTodoDataSchema>;

/** 토큰 사용량 */
export const tokenUsageSchema = z.object({
  input: z.number(),
  output: z.number(),
});
export type TokenUsage = z.infer<typeof tokenUsageSchema>;

/** 파싱 메타데이터 */
export const parseTodoMetaSchema = z.object({
  model: z.string(),
  processingTimeMs: z.number(),
  tokenUsage: tokenUsageSchema,
});
export type ParseTodoMeta = z.infer<typeof parseTodoMetaSchema>;

/** AI 파싱 결과 */
export const parsedTodoResultSchema = z.object({
  data: parsedTodoDataSchema,
  meta: parseTodoMetaSchema,
});
export type ParsedTodoResult = z.infer<typeof parsedTodoResultSchema>;

/** AI 사용량 */
export const aiUsageSchema = z.object({
  used: z.number(),
  limit: z.number(),
  resetsAt: z.string(), // ISO datetime
});
export type AiUsage = z.infer<typeof aiUsageSchema>;

// ============================================================
// Form Schemas
// ============================================================

/** 시간 형식 검증 (HH:mm) */
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Todo 추가 폼 스키마 (startDate 제외 - prop에서 주입) */
export const addTodoFormSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요').max(200, '제목은 200자 이하로 입력해주세요'),
  scheduledTime: z.string().regex(timeRegex, '시간 형식이 올바르지 않습니다 (HH:mm)').nullish(),
  isAllDay: z.boolean().default(true),
  visibility: todoVisibilitySchema.default('PUBLIC'),
  categoryId: z.number().int().default(1),
});
export type AddTodoFormInput = z.input<typeof addTodoFormSchema>;

// ============================================================
// Policy (비즈니스 규칙)
// ============================================================

/** Todo Policy (비즈니스 규칙) */
export const TodoPolicy = {
  /** 기본 Todo 색상 */
  DEFAULT_COLOR: '#FF9500',

  /** Todo 색상 반환 (카테고리 색상 사용) */
  getColor: (todo: TodoItem): string => todo.category.color,

  /** 공개 Todo인지 확인 */
  isPublic: (todo: TodoItem): boolean => todo.visibility === 'PUBLIC',
} as const;
