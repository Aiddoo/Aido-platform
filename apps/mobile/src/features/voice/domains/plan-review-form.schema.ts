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

const planTodoFormSchema = plannedTodoSchema.safeExtend(selectedField);
export type PlanTodoFormValues = z.infer<typeof planTodoFormSchema>;

const planActionFormSchema = z.discriminatedUnion('type', [
  planTodoFormSchema,
  plannedMemoSchema.extend(selectedField),
]);

/** 계획 카드를 고치는 폼. 카드마다 추가할지(`isSelected`)를 함께 든다 */
export const planReviewFormSchema = z.object({ actions: z.array(planActionFormSchema) });

export type PlanReviewFormValues = z.infer<typeof planReviewFormSchema>;

/** 카드 하나를 고치는 시트의 폼. 확인을 누르기 전까지 목록과 초안은 이 값을 보지 못한다 */
export const planTodoEditFormSchema = z.object({ todo: planTodoFormSchema });
export type PlanTodoEditFormValues = z.infer<typeof planTodoEditFormSchema>;

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

/** 기기에 JSON으로 남긴 카드의 날짜 문자열을 `Date`로 되살린다 */
function reviveActionDates(action: unknown) {
  if (!isRecord(action) || action.type !== 'create-todo') {
    return action;
  }
  return {
    ...action,
    startDate: reviveDate(action.startDate),
    endDate: reviveDate(action.endDate),
  };
}

/**
 * 결과를 받은 뒤 고친 카드를 기기에 남겨 앱을 다시 켜도 이어 보는 초안.
 * 읽지 못한 카드가 있어도 나머지는 살리고, 못 살린 수를 `omittedTodoCount`에 더해 화면이 알리게 한다.
 */
export const planReviewDraftSchema = z
  .object({
    omittedTodoCount: z.int().nonnegative(),
    form: z.object({ actions: z.array(z.unknown()) }),
  })
  .transform(({ omittedTodoCount, form }) => {
    const parsed = form.actions.map((action) =>
      planActionFormSchema.safeParse(reviveActionDates(action)),
    );
    const actions = parsed.flatMap((result) => (result.success ? [result.data] : []));
    return {
      omittedTodoCount: omittedTodoCount + parsed.length - actions.length,
      form: { actions },
    };
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
}: {
  userId: string;
  scope: 'memo-plan';
  target: readonly (string | number)[];
}) {
  return createDraftKey({ ownerId: userId, scope, target, schema: planReviewDraftSchema });
}
