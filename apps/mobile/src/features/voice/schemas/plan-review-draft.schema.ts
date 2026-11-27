import { createDraftKey } from '@src/shared/draft/draft.model';

import { createPlanReviewDraftSchema } from './plan-review-form.schema';

/** 고르는 중인 계획을 기기에 남기는 초안 키. 날짜는 저장한 시간대로 다시 읽는다 */
export function createPlanReviewDraftKey({
  userId,
  target,
  timezone,
}: {
  userId: string;
  target: readonly (string | number)[];
  timezone: string;
}) {
  return createDraftKey({
    ownerId: userId,
    scope: 'memo-plan',
    target,
    schema: createPlanReviewDraftSchema(timezone),
  });
}
