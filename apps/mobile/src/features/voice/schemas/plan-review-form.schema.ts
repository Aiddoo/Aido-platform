import { toInstant } from '@src/shared/date/instant';
import { toDateKey } from '@src/shared/date/zoned';
import { isPlainObject } from 'es-toolkit';
import { z } from 'zod';

import {
  type PlanReviewDraft,
  planReviewDraftSchema,
  selectablePlannedTodoSchema,
} from '../domains/voice-plan.model';

export type PlanTodoFormValues = z.infer<typeof selectablePlannedTodoSchema>;

export const planReviewFormSchema = planReviewDraftSchema.shape.form;

export type PlanReviewFormValues = z.infer<typeof planReviewFormSchema>;

const planActionFormSchema = planReviewFormSchema.shape.actions.element;

export const planTodoEditFormSchema = z.object({ todo: selectablePlannedTodoSchema });
export type PlanTodoEditFormValues = z.infer<typeof planTodoEditFormSchema>;

// 저장 시간대가 없는 옛 ISO 초안은 지금 기기 시간대로 읽는다. 자정 반올림 추측은 날짜 선택기 값에서 더 자주 틀린다.
// 초안 보관 기간(30일)이 지난 2026-12-11 이후 옮기는 코드와 함께 지운다(compatibility.md)
export function restoreDraftDateKey(value: unknown, timezone: string) {
  const instant = z.iso.datetime().safeParse(value);
  return instant.success ? toDateKey(toInstant(instant.data), timezone) : value;
}

function restoreActionDates(action: unknown, timezone: string) {
  if (!isPlainObject(action) || action.type !== 'create-todo') {
    return action;
  }
  return {
    ...action,
    startDate: restoreDraftDateKey(action.startDate, timezone),
    endDate: restoreDraftDateKey(action.endDate, timezone),
  };
}

// 읽지 못한 카드가 있어도 나머지는 살리고 못 살린 수를 omittedTodoCount에 더해 화면이 알리게 한다
export function createPlanReviewDraftSchema(timezone: string): z.ZodType<PlanReviewDraft> {
  return z
    .object({
      omittedTodoCount: z.int().nonnegative(),
      form: z.object({ actions: z.array(z.unknown()) }),
    })
    .transform(({ omittedTodoCount, form }) => {
      const parsed = form.actions.map((action) =>
        planActionFormSchema.safeParse(restoreActionDates(action, timezone)),
      );
      const actions = parsed.flatMap((result) => (result.success ? [result.data] : []));
      return {
        omittedTodoCount: omittedTodoCount + parsed.length - actions.length,
        form: { actions },
      };
    });
}
