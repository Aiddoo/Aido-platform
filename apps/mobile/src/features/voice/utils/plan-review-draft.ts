import { createDraftKey } from '@src/shared/draft/draft.model';

import {
  type PlanReviewDraft,
  type PlanSelection,
  VoicePlanPolicy,
  plannedActionSchema,
  type PlannedAction,
  type VoicePlan,
} from '../domains/voice-plan.model';
import {
  createPlanReviewDraftSchema,
  type PlanReviewFormValues,
} from '../schemas/plan-review-form.schema';

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

export function toDraftVoicePlan(
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
  target,
  timeZone,
}: {
  userId: string;
  target: readonly (string | number)[];
  timeZone: string;
}) {
  return createDraftKey({
    ownerId: userId,
    scope: 'memo-plan',
    target,
    schema: createPlanReviewDraftSchema(timeZone),
  });
}
