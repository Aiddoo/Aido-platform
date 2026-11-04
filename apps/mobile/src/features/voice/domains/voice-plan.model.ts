import { ACTION_PLAN_LIMITS, TODO_ITEM_LIMITS } from '@aido/api/vocabulary';
import type { FeatureQuota } from '@src/features/subscription/domains/entitlement.model';
import {
  type TodoRepeat,
  TodoRepeatPolicy,
  todoRepeatSchema,
} from '@src/features/todo/domains/todo-repeat.model';
import { toDeviceDateKey } from '@src/shared/utils/date-key';
import { z } from 'zod';

export const voicePlanIdSchema = z.string().min(1).brand<'VoicePlanId'>();
export const plannedActionIdSchema = z.string().min(1);

const plannedTodoShape = {
  type: z.literal('create-todo'),
  actionId: plannedActionIdSchema,
  title: z.string().trim().min(1).max(ACTION_PLAN_LIMITS.ACTION_TITLE_MAX_LENGTH),
  startDate: z.date(),
  endDate: z.date().nullable(),
  /** null이면 종일 */
  scheduledTime: z.iso.time({ precision: -1 }).nullable(),
  repeat: todoRepeatSchema.nullable(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).nullable(),
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

export const voicePlanSourceSchema = z.enum(['quick-voice', 'quick-text', 'voice-note', 'memo']);
export type VoicePlanSource = z.infer<typeof voicePlanSourceSchema>;

export const voicePlanSchema = z.object({
  planId: voicePlanIdSchema,
  source: voicePlanSourceSchema,
  /** 메모에서 만든 계획의 원본 메모. 저장에 성공하면 서버가 이 메모를 지운다 */
  sourceMemoId: z.int().positive().nullable(),
  actions: z
    .array(plannedActionSchema)
    .max(ACTION_PLAN_LIMITS.MAX_TODOS + ACTION_PLAN_LIMITS.MAX_MEMOS),
  /** 상한을 넘어 계획에 넣지 못한 할 일 수 */
  omittedTodoCount: z.int().nonnegative(),
});
export type VoicePlan = z.infer<typeof voicePlanSchema>;

/** 행동별로 추가할지 고른 값. 키는 `actionId` */
export type PlanSelection = Record<string, boolean>;

export interface QuickPlanResult {
  plan: VoicePlan;
  /** 서버가 한도를 싣지 못했으면 null. 결과는 그대로 보여 주고 한도는 다시 묻는다 */
  featureQuota: FeatureQuota | null;
  /** 이 요청으로 횟수를 썼는지. false면 "횟수는 차감되지 않아요" */
  charged: boolean;
}

export interface VoiceNoteDigestResult extends Omit<QuickPlanResult, 'plan'> {
  plan: VoicePlan;
  title: string;
  summary: string;
  keyPoints: { text: string; startMs: number | null }[];
}

export interface AppliedPlanResult {
  todoCount: number;
  hasMemo: boolean;
}

export function isTodoAction(action: PlannedAction): action is PlannedTodo {
  return action.type === 'create-todo';
}

export function isDuplicateAction(action: PlannedAction) {
  return isTodoAction(action) && action.duplicateOfTodoId != null;
}

export function getDefaultSelection(plan: VoicePlan): PlanSelection {
  return Object.fromEntries(
    plan.actions.map((action) => [action.actionId, !isDuplicateAction(action)]),
  );
}

export function getSelectedActions(plan: VoicePlan, selection: PlanSelection) {
  return plan.actions.filter((action) => selection[action.actionId] === true);
}

export function countSelectedTodos(plan: VoicePlan, selection: PlanSelection) {
  return getSelectedActions(plan, selection).filter(isTodoAction).length;
}

export function canApplyPlan(plan: VoicePlan, selection: PlanSelection) {
  return getSelectedActions(plan, selection).length > 0;
}

/** 반복으로 바꾸면 기간(종료일)은 지운다. 서버가 둘을 함께 받지 않는다 */
export function withRepeat(todo: PlannedTodo, repeat: TodoRepeat | null): PlannedTodo {
  return { ...todo, repeat, endDate: repeat == null ? todo.endDate : null };
}

/** 시작일을 옮기면 기간이 거꾸로 되지 않게 종료일을 같은 길이만큼 옮기고, 반복은 시작일을 따라오는 값을 맞춘다 */
export function withStartDate(todo: PlannedTodo, startDate: Date): PlannedTodo {
  if (todo.repeat != null) {
    return {
      ...todo,
      startDate,
      repeat: TodoRepeatPolicy.withStartDate(
        todo.repeat,
        toDeviceDateKey(todo.startDate),
        toDeviceDateKey(startDate),
      ),
    };
  }
  if (todo.endDate == null) {
    return { ...todo, startDate };
  }
  const span = todo.endDate.getTime() - todo.startDate.getTime();
  return { ...todo, startDate, endDate: new Date(startDate.getTime() + span) };
}

export function withScheduledTime(todo: PlannedTodo, scheduledTime: string | null): PlannedTodo {
  return { ...todo, scheduledTime };
}

/** 저장 요청에 보낼 카테고리. AI가 고르지 못한 칸은 시트의 현재 카테고리로 채운다 */
export function getCategoryId(todo: PlannedTodo, fallbackCategoryId: number) {
  return todo.categoryId ?? fallbackCategoryId;
}

export const VoicePlanPolicy = {
  isDuplicateAction,
  getDefaultSelection,
  getSelectedActions,
  countSelectedTodos,
  canApplyPlan,
} as const;
