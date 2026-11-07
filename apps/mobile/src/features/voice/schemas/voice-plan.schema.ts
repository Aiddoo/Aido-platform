import { ACTION_PLAN_LIMITS, TODO_ITEM_LIMITS, TODO_VISIBILITIES } from '@aido/api/vocabulary';
import { todoRepeatSchema } from '@src/features/planning/todo/schemas/todo-repeat.schema';
import { z } from 'zod';

export const voicePlanIdSchema = z.string().min(1).brand<'VoicePlanId'>();
const plannedActionIdSchema = z.string().min(1);

const plannedTodoShape = {
  type: z.literal('create-todo'),
  actionId: plannedActionIdSchema,
  title: z.string().trim().min(1).max(ACTION_PLAN_LIMITS.ACTION_TITLE_MAX_LENGTH),
  startDate: z.iso.date(),
  endDate: z.iso.date().nullable(),
  /** null이면 종일 */
  scheduledTime: z.iso.time({ precision: -1 }).nullable(),
  repeat: todoRepeatSchema.nullable(),
  visibility: z.enum(TODO_VISIBILITIES).nullable(),
  items: z
    .array(
      z.object({ title: z.string().trim().min(1).max(ACTION_PLAN_LIMITS.ACTION_TITLE_MAX_LENGTH) }),
    )
    .max(TODO_ITEM_LIMITS.MAX_PER_TODO),
  /** AI가 고르지 못했으면 null. 저장할 때 시트의 현재 카테고리로 채운다 */
  categoryId: z.int().positive().nullable(),
  duplicateOfTodoId: z.int().positive().nullable(),
};

const plannedMemoShape = {
  type: z.literal('create-memo'),
  actionId: plannedActionIdSchema,
  title: z.string().trim().max(ACTION_PLAN_LIMITS.ACTION_TITLE_MAX_LENGTH),
  content: z.string().trim().min(1),
};

/** 서버가 저장할 때 막는 규칙(반복에는 종료일 없음, 종료일은 시작일 이후)을 카드를 고치는 동안에도 지킨다 */
export const plannedTodoSchema = z
  .object(plannedTodoShape)
  .refine((todo) => todo.repeat == null || todo.endDate == null, { path: ['endDate'] })
  .refine((todo) => todo.endDate == null || todo.endDate >= todo.startDate, { path: ['endDate'] });
export const plannedMemoSchema = z.object(plannedMemoShape);

export const plannedActionSchema = z.discriminatedUnion('type', [
  plannedTodoSchema,
  plannedMemoSchema,
]);
export type PlannedTodo = z.infer<typeof plannedTodoSchema>;
export type PlannedMemo = z.infer<typeof plannedMemoSchema>;
export type PlannedAction = z.infer<typeof plannedActionSchema>;

const voicePlanSourceSchema = z.enum(['quick-voice', 'quick-text', 'voice-note', 'memo']);
export type VoicePlanSource = z.infer<typeof voicePlanSourceSchema>;

export const voicePlanSchema = z.object({
  planId: voicePlanIdSchema,
  source: voicePlanSourceSchema,
  /** 메모에서 만든 계획의 원본 메모. 저장에 성공하면 서버가 이 메모를 지운다 */
  sourceMemoId: z.int().positive().nullable(),
  actions: z
    .array(plannedActionSchema)
    .max(ACTION_PLAN_LIMITS.MAX_TODOS + ACTION_PLAN_LIMITS.MAX_MEMOS),
  omittedTodoCount: z.int().nonnegative(),
});
export type VoicePlan = z.infer<typeof voicePlanSchema>;
