import { z } from 'zod';

/** Todo 공개 범위 */
export const todoVisibilitySchema = z.enum(['PUBLIC', 'PRIVATE']);
export type TodoVisibility = z.infer<typeof todoVisibilitySchema>;

/** 시간 형식 검증 (HH:mm) */
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Todo 추가 폼 스키마 (startDate 제외 - prop에서 주입) */
export const addTodoFormSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요').max(200, '제목은 200자 이하로 입력해주세요'),
  scheduledTime: z.string().regex(timeRegex, '시간 형식이 올바르지 않습니다 (HH:mm)').nullish(),
  isAllDay: z.boolean().default(true),
  visibility: todoVisibilitySchema.default('PUBLIC'),
});
export type AddTodoFormInput = z.input<typeof addTodoFormSchema>;

/** Todo 도메인 모델 스키마 */
export const TodoItemSchema = z.object({
  id: z.number(),
  title: z.string(),
  color: z.string().nullable(),
  completed: z.boolean(),
  scheduledTime: z.date().nullable(),
  isAllDay: z.boolean(),
  visibility: todoVisibilitySchema,
});

export type TodoItem = z.infer<typeof TodoItemSchema>;

/** 날짜별 Todo 목록 */
export interface TodosByDate {
  date: string; // YYYY-MM-DD
  todos: TodoItem[];
}

/** Todo Policy (비즈니스 규칙) */
export const TodoPolicy = {
  /** 기본 Todo 색상 */
  DEFAULT_COLOR: '#FF9500',

  /** Todo 색상 반환 (없으면 기본색) */
  getColor: (todo: TodoItem): string => todo.color ?? TodoPolicy.DEFAULT_COLOR,

  /** 공개 Todo인지 확인 */
  isPublic: (todo: TodoItem): boolean => todo.visibility === 'PUBLIC',
};

/** Todo 개수 정보 (캘린더용) - date: YYYY-MM-DD, count */
export type TodoCountByDate = Record<string, number>;

/** Todo 목록 조회 결과 */
export interface TodosResult {
  todos: TodoItem[];
  hasNext: boolean;
  nextCursor: number | null;
}
