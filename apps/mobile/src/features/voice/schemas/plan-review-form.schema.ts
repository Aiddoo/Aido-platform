import { toDateKey, toInstant } from '@src/shared/date/instant';
import { z } from 'zod';

import { plannedMemoSchema, plannedTodoSchema } from './voice-plan.schema';

const selectedField = { isSelected: z.boolean() };

const planTodoFormSchema = plannedTodoSchema.safeExtend(selectedField);
export type PlanTodoFormValues = z.infer<typeof planTodoFormSchema>;

const planActionFormSchema = z.discriminatedUnion('type', [
  planTodoFormSchema,
  plannedMemoSchema.extend(selectedField),
]);

export const planReviewFormSchema = z.object({ actions: z.array(planActionFormSchema) });

export type PlanReviewFormValues = z.infer<typeof planReviewFormSchema>;

export const planTodoEditFormSchema = z.object({ todo: planTodoFormSchema });
export type PlanTodoEditFormValues = z.infer<typeof planTodoEditFormSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null;
}

/**
 * 달력 날짜를 `Date`로 들던 때의 초안은 ISO 순간으로 남아 있고, 저장 때의 시간대는 기록되지 않았다.
 * 날짜 선택기를 거친 값은 자정이 아닐 수도 있어 UTC 자정 반올림 같은 추측은 더 자주 틀린다. 그래서
 * 지금 기기 시간대로 읽는다. 저장한 시간대에 그대로 있으면 사용자가 보던 날짜와 같고, 그 사이 시간대를
 * 옮긴 초안만 하루 밀릴 수 있지만 저장 전 카드에서 보고 고칠 수 있다.
 */
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

/**
 * 결과를 받은 뒤 고친 카드를 기기에 남겨 앱을 다시 켜도 이어 보는 초안.
 * 읽지 못한 카드가 있어도 나머지는 살리고, 못 살린 수를 `omittedTodoCount`에 더해 화면이 알리게 한다.
 */
export function createPlanReviewDraftSchema(timeZone: string) {
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
export type PlanReviewDraft = z.infer<ReturnType<typeof createPlanReviewDraftSchema>>;
