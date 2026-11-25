import { ACTION_PLAN_LIMITS, TODO_ITEM_LIMITS, TODO_VISIBILITIES } from '@aido/api/vocabulary';
import type { FeatureQuota } from '@src/features/billing/subscription/domains/feature-quota.model';
import { todoRepeatSchema } from '@src/features/planning/todo/domains/todo-repeat.model';
import { dateKeyFieldSchema } from '@src/shared/date/date-key';
import { z } from 'zod';

export const voicePlanIdSchema = z.string().min(1).brand<'VoicePlanId'>();
const plannedActionIdSchema = z.string().min(1);

const plannedTodoShape = {
  type: z.literal('create-todo'),
  actionId: plannedActionIdSchema,
  title: z.string().trim().min(1).max(ACTION_PLAN_LIMITS.ACTION_TITLE_MAX_LENGTH),
  startDate: dateKeyFieldSchema,
  endDate: dateKeyFieldSchema.nullable(),
  scheduledTime: z.iso.time({ precision: -1 }).nullable(),
  repeat: todoRepeatSchema.nullable(),
  visibility: z.enum(TODO_VISIBILITIES).nullable(),
  items: z
    .array(
      z.object({ title: z.string().trim().min(1).max(ACTION_PLAN_LIMITS.ACTION_TITLE_MAX_LENGTH) }),
    )
    .max(TODO_ITEM_LIMITS.MAX_PER_TODO),
  categoryId: z.int().positive().nullable(),
  duplicateOfTodoId: z.int().positive().nullable(),
};

const plannedMemoShape = {
  type: z.literal('create-memo'),
  actionId: plannedActionIdSchema,
  title: z.string().trim().max(ACTION_PLAN_LIMITS.ACTION_TITLE_MAX_LENGTH),
  content: z.string().trim().min(1),
};

// 서버가 저장 때 막는 규칙(반복에는 종료일 없음, 종료일은 시작일 이후)을 카드를 고치는 동안에도 지킨다
export const plannedTodoSchema = z
  .object(plannedTodoShape)
  .refine((todo) => todo.repeat == null || todo.endDate == null, { path: ['endDate'] })
  .refine((todo) => todo.endDate == null || todo.startDate <= todo.endDate, { path: ['endDate'] });
export const plannedMemoSchema = z.object(plannedMemoShape);

export const plannedActionSchema = z.discriminatedUnion('type', [
  plannedTodoSchema,
  plannedMemoSchema,
]);
export type PlannedTodo = z.infer<typeof plannedTodoSchema>;
export type PlannedMemo = z.infer<typeof plannedMemoSchema>;
export type PlannedAction = z.infer<typeof plannedActionSchema>;

// 기기에 저장된 음성 노트 초안이 이 표기를 쓰므로 서버 값(ACTION_PLAN_SOURCES)으로 바꾸지 않고 mapper가 한 번 옮긴다
export const voicePlanSourceSchema = z.enum(['quick-voice', 'quick-text', 'voice-note', 'memo']);
export type VoicePlanSource = z.infer<typeof voicePlanSourceSchema>;

export const voicePlanSchema = z.object({
  planId: voicePlanIdSchema,
  source: voicePlanSourceSchema,
  // 저장에 성공하면 서버가 이 원본 메모를 지운다
  sourceMemoId: z.int().positive().nullable(),
  actions: z
    .array(plannedActionSchema)
    .max(ACTION_PLAN_LIMITS.MAX_TODOS + ACTION_PLAN_LIMITS.MAX_MEMOS),
  omittedTodoCount: z.int().nonnegative(),
});
export type VoicePlan = z.infer<typeof voicePlanSchema>;

export interface QuickPlanResult {
  plan: VoicePlan;
  // 서버가 한도를 싣지 못하면 null이다. 결과는 보여 주고 한도는 다시 묻는다
  featureQuota: FeatureQuota | null;
  isCharged: boolean;
}

export interface AppliedPlanResult {
  todoCount: number;
  hasMemo: boolean;
}

// 카테고리를 정하지 않은 할 일은 시트의 현재 카테고리에 넣는다. 고르는 폼 카드도 같은 규칙이라 카테고리 값만 받는다
export function getPlannedCategoryId(
  categoryId: number | null,
  fallbackCategoryId: number,
): number {
  return categoryId ?? fallbackCategoryId;
}

/** 행동별로 추가할지 고른 값. 키는 `actionId` */
export type PlanSelection = Record<string, boolean>;

export const VoicePlanPolicy = {
  isTodoAction(action: PlannedAction): action is PlannedTodo {
    return action.type === 'create-todo';
  },

  isDuplicateAction(action: PlannedAction): boolean {
    return this.isTodoAction(action) && action.duplicateOfTodoId != null;
  },

  getDefaultSelection(plan: VoicePlan): PlanSelection {
    return Object.fromEntries(
      plan.actions.map((action) => [action.actionId, !this.isDuplicateAction(action)]),
    );
  },

  getSelectedActions(plan: VoicePlan, selection: PlanSelection): PlannedAction[] {
    return plan.actions.filter((action) => selection[action.actionId] === true);
  },

  getSelectedTodoCount(plan: VoicePlan, selection: PlanSelection): number {
    return this.getSelectedActions(plan, selection).filter((action) => this.isTodoAction(action))
      .length;
  },

  canApplyPlan(plan: VoicePlan, selection: PlanSelection): boolean {
    return this.getSelectedActions(plan, selection).length > 0;
  },
};
