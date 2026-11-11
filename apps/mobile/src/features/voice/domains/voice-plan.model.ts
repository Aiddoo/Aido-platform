import { ACTION_PLAN_LIMITS, TODO_ITEM_LIMITS, TODO_VISIBILITIES } from '@aido/api/vocabulary';
import type { FeatureQuota } from '@src/features/billing/subscription/domains/entitlement.model';
import { todoRepeatSchema } from '@src/features/planning/todo/domains/todo-repeat.model';
import { groupBy, uniq } from 'es-toolkit';
import { z } from 'zod';

export const voicePlanIdSchema = z.string().min(1).brand<'VoicePlanId'>();
const plannedActionIdSchema = z.string().min(1);

const plannedTodoShape = {
  type: z.literal('create-todo'),
  actionId: plannedActionIdSchema,
  title: z.string().trim().min(1).max(ACTION_PLAN_LIMITS.ACTION_TITLE_MAX_LENGTH),
  startDate: z.iso.date(),
  endDate: z.iso.date().nullable(),
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
const plannedTodoSchema = z
  .object(plannedTodoShape)
  .refine((todo) => todo.repeat == null || todo.endDate == null, { path: ['endDate'] })
  .refine((todo) => todo.endDate == null || todo.startDate <= todo.endDate, { path: ['endDate'] });
const plannedMemoSchema = z.object(plannedMemoShape);

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

export interface VoiceNoteDigestResult extends QuickPlanResult {
  title: string;
  summary: string;
  keyPoints: { text: string; startMs: number | null }[];
}

export interface AppliedPlanResult {
  todoCount: number;
  hasMemo: boolean;
}

/** 행동별로 추가할지 고른 값. 키는 `actionId` */
export type PlanSelection = Record<string, boolean>;

const selectedField = { isSelected: z.boolean() };

export const selectablePlannedTodoSchema = plannedTodoSchema.safeExtend(selectedField);

const selectablePlannedActionSchema = z.discriminatedUnion('type', [
  selectablePlannedTodoSchema,
  plannedMemoSchema.extend(selectedField),
]);

// 고르는 중인 카드와 서버가 빼고 준 할 일 수. 말로 메모하기 초안이 이 모양(`form` 포함) 그대로 기기에 남는다
export const planReviewDraftSchema = z.object({
  omittedTodoCount: z.int().nonnegative(),
  form: z.object({ actions: z.array(selectablePlannedActionSchema) }),
});
export type PlanReviewDraft = z.infer<typeof planReviewDraftSchema>;

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

export function getSelectedTodoCount(plan: VoicePlan, selection: PlanSelection) {
  return getSelectedActions(plan, selection).filter(isTodoAction).length;
}

export function canApplyPlan(plan: VoicePlan, selection: PlanSelection) {
  return getSelectedActions(plan, selection).length > 0;
}

// 고르기 시트의 폼 카드도 묶어 Policy 밖 함수로 두고 종류와 카테고리만 받는다
type PlanGroupableAction = Pick<PlannedTodo, 'type' | 'categoryId'> | Pick<PlannedMemo, 'type'>;

/** 한 카테고리의 카드들. 메모는 카테고리가 없어 `categoryId`가 null인 묶음으로 맨 뒤에 모인다 */
interface PlanActionGroup {
  categoryId: number | null;
  /** 폼 배열에서의 자리. 묶어 보여도 카드를 고칠 때는 이 자리를 쓴다 */
  indexes: number[];
}

export function getPlanActionGroups(
  actions: readonly PlanGroupableAction[],
  fallbackCategoryId: number,
): PlanActionGroup[] {
  const memoIndexes = actions.flatMap((action, index) =>
    action.type === 'create-memo' ? [index] : [],
  );
  const todos = actions.flatMap((action, index) =>
    action.type === 'create-memo'
      ? []
      : [{ index, categoryId: action.categoryId ?? fallbackCategoryId }],
  );
  const todosByCategory = groupBy(todos, ({ categoryId }) => categoryId);
  // 숫자 키 객체는 오름차순으로 돌아 먼저 말한 카테고리 순서를 잃는다. 순서는 uniq로 따로 지킨다
  const groups: PlanActionGroup[] = uniq(todos.map(({ categoryId }) => categoryId)).map(
    (categoryId) => ({
      categoryId,
      indexes: (todosByCategory[categoryId] ?? []).map(({ index }) => index),
    }),
  );
  return memoIndexes.length === 0
    ? groups
    : [...groups, { categoryId: null, indexes: memoIndexes }];
}

// 화면에 묶어 보인 순서대로 늘어놓는다. 저장 순서가 사용자가 본 순서와 같아진다
export function sortPlanActionsByGroup<TAction extends PlanGroupableAction>(
  actions: readonly TAction[],
  fallbackCategoryId: number,
): TAction[] {
  return getPlanActionGroups(actions, fallbackCategoryId).flatMap(({ indexes }) =>
    indexes.flatMap((index) => actions.slice(index, index + 1)),
  );
}

export type PlanHeadline =
  | { kind: 'todos'; count: number }
  | { kind: 'memo' }
  | { kind: 'already-added' };

// 계획 카드 위 머리글이 말할 내용. 문구는 화면이 고른다
export function getHeadline(plan: VoicePlan, selection: PlanSelection): PlanHeadline {
  const selectedTodoCount = getSelectedTodoCount(plan, selection);
  if (selectedTodoCount > 0) {
    return { kind: 'todos', count: selectedTodoCount };
  }
  if (getSelectedActions(plan, selection).length > 0) {
    return { kind: 'memo' };
  }
  const todos = plan.actions.filter(isTodoAction);
  if (todos.length === 0) {
    return { kind: 'memo' };
  }
  return todos.every(isDuplicateAction)
    ? { kind: 'already-added' }
    : { kind: 'todos', count: todos.length };
}

export const VoicePlanPolicy = {
  getDefaultSelection,
  isTodoAction,
  isDuplicateAction,
  getSelectedActions,
  getSelectedTodoCount,
  getHeadline,
  canApplyPlan,
} as const;
