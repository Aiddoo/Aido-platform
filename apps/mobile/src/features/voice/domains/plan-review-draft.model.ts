import { z } from 'zod';

import {
  type PlannedAction,
  PlannedActionPolicy,
  plannedActionSchema,
  plannedMemoSchema,
  plannedTodoSchema,
} from './planned-action.model';
import { type PlanSelection, type VoicePlan, VoicePlanPolicy } from './voice-plan.model';

const selectedField = { isSelected: z.boolean() };

export const selectablePlannedTodoSchema = plannedTodoSchema.safeExtend(selectedField);

const selectablePlannedActionSchema = z.discriminatedUnion('type', [
  selectablePlannedTodoSchema,
  plannedMemoSchema.extend(selectedField),
]);
export type SelectablePlannedAction = z.infer<typeof selectablePlannedActionSchema>;

// 고르는 중인 카드와 서버가 빼고 준 할 일 수. 말로 메모하기 초안이 이 모양(`form` 포함) 그대로 기기에 남는다
export const planReviewDraftSchema = z.object({
  omittedTodoCount: z.int().nonnegative(),
  form: z.object({ actions: z.array(selectablePlannedActionSchema) }),
});
export type PlanReviewDraft = z.infer<typeof planReviewDraftSchema>;

/** 서버가 준 계획으로 고르기를 시작한다. 이미 있는 할 일만 꺼 둔다 */
export function createPlanReviewDraft(plan: VoicePlan): PlanReviewDraft {
  const selection = VoicePlanPolicy.getDefaultSelection(plan);

  return {
    omittedTodoCount: plan.omittedTodoCount,
    form: {
      actions: plan.actions.map((action) => ({
        ...action,
        isSelected: selection[action.actionId] === true,
      })),
    },
  };
}

/** 기기에 남긴 초안의 카드로 저장에 쓸 계획을 다시 만든다. 어느 화면의 계획인지는 부르는 쪽이 안다 */
export function createDraftVoicePlan(
  { planId, source, sourceMemoId }: Pick<VoicePlan, 'planId' | 'source' | 'sourceMemoId'>,
  draft: PlanReviewDraft,
): VoicePlan {
  return {
    planId,
    source,
    sourceMemoId,
    actions: PlanReviewDraftPolicy.getPlannedActions(draft.form.actions),
    omittedTodoCount: draft.omittedTodoCount,
  };
}

export const PlanReviewDraftPolicy = {
  getTodoCount(draft: PlanReviewDraft): number {
    return draft.form.actions.filter((action) => PlannedActionPolicy.isTodoAction(action)).length;
  },

  hasTodo(draft: PlanReviewDraft): boolean {
    return draft.form.actions.some((action) => PlannedActionPolicy.isTodoAction(action));
  },

  getPlannedActions(actions: readonly SelectablePlannedAction[]): PlannedAction[] {
    return actions.map(({ isSelected: _isSelected, ...action }) =>
      plannedActionSchema.parse(action),
    );
  },

  getSelection(actions: readonly SelectablePlannedAction[]): PlanSelection {
    return Object.fromEntries(actions.map((action) => [action.actionId, action.isSelected]));
  },
};
