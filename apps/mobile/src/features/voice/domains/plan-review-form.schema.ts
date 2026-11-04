import { createDraftKey } from '@src/shared/draft/draft.model';
import { z } from 'zod';

import {
  type PlanSelection,
  type PlannedAction,
  plannedActionSchema,
  type VoicePlan,
  getDefaultSelection,
  plannedMemoSchema,
  plannedTodoSchema,
} from './voice-plan.model';

const selectedField = { isSelected: z.boolean() };

/** 계획 카드를 고치는 폼. 카드마다 추가할지(`isSelected`)를 함께 든다 */
export const planReviewFormSchema = z.object({
  actions: z.array(
    z.discriminatedUnion('type', [
      plannedTodoSchema.safeExtend(selectedField),
      plannedMemoSchema.extend(selectedField),
    ]),
  ),
});

export type PlanReviewFormValues = z.infer<typeof planReviewFormSchema>;

export function createPlanReviewFormValues(
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

/** 폼의 카드와 고른 상태를 정책이 읽는 모양으로 되돌린다 */
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value != null;

const reviveDate = (value: unknown) => (typeof value === 'string' ? new Date(value) : value);

/** 기기에 JSON으로 남긴 초안의 날짜 문자열을 `Date`로 되살린다 */
function reviveDates(raw: unknown) {
  if (!isRecord(raw) || !Array.isArray(raw.actions)) {
    return raw;
  }
  return {
    ...raw,
    actions: raw.actions.map((action: unknown) => {
      if (!isRecord(action) || action.type !== 'create-todo') {
        return action;
      }
      return {
        ...action,
        startDate: reviveDate(action.startDate),
        endDate: reviveDate(action.endDate),
      };
    }),
  };
}

/** 결과를 받은 뒤 고친 카드를 기기에 남겨 앱을 다시 켜도 이어 보는 초안 */
export const planReviewDraftSchema = z.object({
  omittedTodoCount: z.int().nonnegative(),
  form: z.unknown().transform(reviveDates).pipe(planReviewFormSchema),
});
export type PlanReviewDraft = z.infer<typeof planReviewDraftSchema>;

export function createPlanReviewDraft(
  plan: VoicePlan,
  form: PlanReviewFormValues = createPlanReviewFormValues(plan),
): PlanReviewDraft {
  return { omittedTodoCount: plan.omittedTodoCount, form };
}

/** 초안에서 `PlanReview`가 받는 계획을 되살린다 */
export function toVoicePlanFromDraft(
  { planId, source }: Pick<VoicePlan, 'planId' | 'source'>,
  draft: PlanReviewDraft,
): VoicePlan {
  return {
    planId,
    source,
    actions: toPlannedActions(draft.form),
    omittedTodoCount: draft.omittedTodoCount,
  };
}

export function createPlanReviewDraftKey({
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
