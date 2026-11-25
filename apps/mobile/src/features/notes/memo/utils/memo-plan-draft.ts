import { createPlanReviewDraftKey } from '@src/features/voice/schemas/plan-review-draft.schema';
import { createDraftKey } from '@src/shared/draft/draft.model';

import { memoPlanRequestDraftSchema } from '../schemas/memo-draft.schema';

export function createMemoPlanDraftKey({
  userId,
  memoId,
  timezone,
}: {
  userId: string;
  memoId: number;
  timezone: string;
}) {
  return createPlanReviewDraftKey({
    userId,
    target: [memoId],
    timezone,
  });
}

/** 응답을 받지 못한 요청의 멱등 키. 앱을 다시 켜고 다시 눌러도 같은 키를 보내야 두 번 차감되지 않는다 */
export function createMemoPlanRequestDraftKey({
  userId,
  memoId,
}: {
  userId: string;
  memoId: number;
}) {
  return createDraftKey({
    ownerId: userId,
    scope: 'memo-plan-request',
    target: [memoId],
    schema: memoPlanRequestDraftSchema,
  });
}
