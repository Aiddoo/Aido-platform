import { createDraftKey } from '@src/shared/draft/draft.model';

import { type PlanSelection, VoicePlanPolicy } from '../domains/voice-plan.model';
import {
  createPlanReviewDraftSchema,
  type PlanReviewDraft,
  type PlanReviewFormValues,
} from '../schemas/plan-review-form.schema';
import {
  plannedActionSchema,
  type PlannedAction,
  type VoicePlan,
} from '../schemas/voice-plan.schema';

export function createPlanReviewFormValues(
  plan: VoicePlan,
  selection: PlanSelection = VoicePlanPolicy.getDefaultSelection(plan),
): PlanReviewFormValues {
  return {
    actions: plan.actions.map((action) => ({
      ...action,
      isSelected: selection[action.actionId] === true,
    })),
  };
}

export function toPlannedActions({ actions }: PlanReviewFormValues): PlannedAction[] {
  return actions.map(({ isSelected: _isSelected, ...action }) => plannedActionSchema.parse(action));
}

export function toPlanSelection({
  actions,
}: {
  actions: readonly { actionId: string; isSelected: boolean }[];
}): PlanSelection {
  return Object.fromEntries(actions.map((action) => [action.actionId, action.isSelected]));
}

export function createPlanReviewDraft(
  plan: VoicePlan,
  form: PlanReviewFormValues = createPlanReviewFormValues(plan),
): PlanReviewDraft {
  return { omittedTodoCount: plan.omittedTodoCount, form };
}

export function toVoicePlanFromDraft(
  { planId, source, sourceMemoId }: Pick<VoicePlan, 'planId' | 'source' | 'sourceMemoId'>,
  draft: PlanReviewDraft,
): VoicePlan {
  return {
    planId,
    source,
    sourceMemoId,
    actions: toPlannedActions(draft.form),
    omittedTodoCount: draft.omittedTodoCount,
  };
}

export function createPlanReviewDraftKey({
  userId,
  scope,
  target,
  timeZone,
}: {
  userId: string;
  scope: 'memo-plan';
  target: readonly (string | number)[];
  timeZone: string;
}) {
  return createDraftKey({
    ownerId: userId,
    scope,
    target,
    schema: createPlanReviewDraftSchema(timeZone),
  });
}
