import { createDraftKey } from '@src/shared/draft/draft.model';

import {
  type PlanReviewDraft,
  type PlanReviewFormValues,
  planReviewDraftSchema,
} from '../schemas/plan-review-form.schema';
import {
  plannedActionSchema,
  type PlannedAction,
  type VoicePlan,
} from '../schemas/voice-plan.schema';
import { getDefaultSelection, type PlanSelection } from './voice-plan.model';

function createFormValues(
  plan: VoicePlan,
  selection: PlanSelection = getDefaultSelection(plan),
): PlanReviewFormValues {
  return {
    actions: plan.actions.map((action) => ({
      ...action,
      isSelected: selection[action.actionId] === true,
    })),
  };
}

function toPlannedActions({ actions }: PlanReviewFormValues): PlannedAction[] {
  return actions.map(({ isSelected: _isSelected, ...action }) => plannedActionSchema.parse(action));
}

function toPlanSelection({
  actions,
}: {
  actions: readonly { actionId: string; isSelected: boolean }[];
}): PlanSelection {
  return Object.fromEntries(actions.map((action) => [action.actionId, action.isSelected]));
}

function createDraft(
  plan: VoicePlan,
  form: PlanReviewFormValues = createFormValues(plan),
): PlanReviewDraft {
  return { omittedTodoCount: plan.omittedTodoCount, form };
}

function toVoicePlanFromDraft(
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

function createDraftStorageKey({
  userId,
  scope,
  target,
}: {
  userId: string;
  scope: 'memo-plan';
  target: readonly (string | number)[];
}) {
  return createDraftKey({ ownerId: userId, scope, target, schema: planReviewDraftSchema });
}

export const PlanReviewPolicy = {
  createFormValues,
  toPlannedActions,
  toPlanSelection,
  createDraft,
  toVoicePlanFromDraft,
  createDraftStorageKey,
} as const;
