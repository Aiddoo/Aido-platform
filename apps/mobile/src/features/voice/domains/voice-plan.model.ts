import type { FeatureQuota } from '@src/features/billing/subscription/schemas/entitlement.schema';
import { TodoRepeatPolicy } from '@src/features/planning/todo/domains/todo-repeat.model';
import type { TodoRepeat } from '@src/features/planning/todo/schemas/todo-repeat.schema';
import { addDaysToDateKey, diffDateKeysInDays } from '@src/shared/date/date-key';
import { groupBy, uniq } from 'es-toolkit';

import type {
  PlannedAction,
  PlannedMemo,
  PlannedTodo,
  VoicePlan,
} from '../schemas/voice-plan.schema';

/** 행동별로 추가할지 고른 값. 키는 `actionId` */
export type PlanSelection = Record<string, boolean>;

export interface CreateQuickPlanInput {
  text: string;
  source: 'voice' | 'text';
}

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

function isDuplicateAction(action: PlannedAction) {
  return isTodoAction(action) && action.duplicateOfTodoId != null;
}

function getDefaultSelection(plan: VoicePlan): PlanSelection {
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
export function withStartDate(todo: PlannedTodo, startDate: string): PlannedTodo {
  if (todo.repeat != null) {
    return {
      ...todo,
      startDate,
      repeat: TodoRepeatPolicy.withRepeatStartDate(todo.repeat, todo.startDate, startDate),
    };
  }
  if (todo.endDate == null) {
    return { ...todo, startDate };
  }
  const spanInDays = diffDateKeysInDays(todo.startDate, todo.endDate);
  return { ...todo, startDate, endDate: addDaysToDateKey(startDate, spanInDays) };
}

function withScheduledTime(todo: PlannedTodo, scheduledTime: string | null): PlannedTodo {
  return { ...todo, scheduledTime };
}

export type PlanGroupableAction =
  | Pick<PlannedTodo, 'type' | 'categoryId'>
  | Pick<PlannedMemo, 'type'>;

/** 한 카테고리의 카드들. 메모는 카테고리가 없어 `categoryId`가 null인 묶음으로 맨 뒤에 모인다 */
export interface PlanActionGroup {
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

/** 화면에 묶어 보인 순서대로 늘어놓는다. 저장 순서가 사용자가 본 순서와 같아진다 */
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

/** 계획 카드 위 머리글이 말할 내용. 문구는 화면이 고른다 */
function getHeadline(plan: VoicePlan, selection: PlanSelection): PlanHeadline {
  const selectedTodoCount = countSelectedTodos(plan, selection);
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
  withRepeat,
  withStartDate,
  withScheduledTime,
  isDuplicateAction,
  getSelectedActions,
  countSelectedTodos,
  getHeadline,
  canApplyPlan,
  getPlanActionGroups,
  sortPlanActionsByGroup,
} as const;
