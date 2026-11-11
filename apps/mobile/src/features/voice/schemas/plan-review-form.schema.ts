import { toInstant } from '@src/shared/date/instant';
import { toDateKey } from '@src/shared/date/zoned';
import { z } from 'zod';

import { plannedMemoSchema, plannedTodoSchema } from '../domains/voice-plan.model';

const selectedField = { isSelected: z.boolean() };

const planTodoFormSchema = plannedTodoSchema.safeExtend(selectedField);
export type PlanTodoFormValues = z.infer<typeof planTodoFormSchema>;

const planActionFormSchema = z.discriminatedUnion('type', [
  planTodoFormSchema,
  plannedMemoSchema.extend(selectedField),
]);

export const planReviewFormSchema = z.object({ actions: z.array(planActionFormSchema) });

export type PlanReviewFormValues = z.infer<typeof planReviewFormSchema>;

export const planReviewDraftSchema = z.object({
  omittedTodoCount: z.int().nonnegative(),
  form: planReviewFormSchema,
});
export type PlanReviewDraft = z.infer<typeof planReviewDraftSchema>;

export const planTodoEditFormSchema = z.object({ todo: planTodoFormSchema });
export type PlanTodoEditFormValues = z.infer<typeof planTodoEditFormSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null;
}

// 저장 시간대가 없는 옛 ISO 초안은 지금 기기 시간대로 읽는다. 자정 반올림 추측은 날짜 선택기 값에서 더 자주 틀린다
export function restoreDraftDateKey(value: unknown, timeZone: string) {
  const instant = z.iso.datetime().safeParse(value);
  return instant.success ? toDateKey(toInstant(instant.data), timeZone) : value;
}

function restoreActionDates(action: unknown, timeZone: string) {
  if (!isRecord(action) || action.type !== 'create-todo') {
    return action;
  }
  return {
    ...action,
    startDate: restoreDraftDateKey(action.startDate, timeZone),
    endDate: restoreDraftDateKey(action.endDate, timeZone),
  };
}

// 읽지 못한 카드가 있어도 나머지는 살리고 못 살린 수를 omittedTodoCount에 더해 화면이 알리게 한다
export function createPlanReviewDraftSchema(timeZone: string): z.ZodType<PlanReviewDraft> {
  return z
    .object({
      omittedTodoCount: z.int().nonnegative(),
      form: z.object({ actions: z.array(z.unknown()) }),
    })
    .transform(({ omittedTodoCount, form }) => {
      const parsed = form.actions.map((action) =>
        planActionFormSchema.safeParse(restoreActionDates(action, timeZone)),
      );
      const actions = parsed.flatMap((result) => (result.success ? [result.data] : []));
      return {
        omittedTodoCount: omittedTodoCount + parsed.length - actions.length,
        form: { actions },
      };
    });
}
