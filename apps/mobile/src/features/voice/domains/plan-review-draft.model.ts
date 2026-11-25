import { z } from 'zod';

import { plannedMemoSchema, plannedTodoSchema, VoicePlanPolicy } from './voice-plan.model';

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

export const PlanReviewDraftPolicy = {
  getTodoCount(draft: PlanReviewDraft): number {
    return draft.form.actions.filter((action) => VoicePlanPolicy.isTodoAction(action)).length;
  },

  hasTodo(draft: PlanReviewDraft): boolean {
    return draft.form.actions.some((action) => VoicePlanPolicy.isTodoAction(action));
  },
};
