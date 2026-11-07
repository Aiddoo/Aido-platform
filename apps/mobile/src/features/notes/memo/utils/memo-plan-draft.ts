import { PlanRequestPolicy } from '@src/features/voice/domains/plan-request.model';
import { createPlanReviewDraftKey } from '@src/features/voice/utils/plan-review-draft';
import { createDraftKey } from '@src/shared/draft/draft.model';
import type { DraftService } from '@src/shared/draft/draft.service';

import { memoPlanRequestDraftSchema } from '../schemas/memo-draft.schema';

export function createMemoPlanDraftKey({
  userId,
  memoId,
  timeZone,
}: {
  userId: string;
  memoId: number;
  timeZone: string;
}) {
  return createPlanReviewDraftKey({
    userId,
    target: [memoId],
    timeZone,
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

export function prepareMemoPlanIdempotencyKey(
  draftService: Pick<DraftService, 'restore' | 'save'>,
  {
    userId,
    memoId,
    content,
    categoryId,
    sourceUpdatedAt,
    createIdempotencyKey,
  }: {
    userId: string;
    memoId: number;
    content: string;
    categoryId: number;
    sourceUpdatedAt: number;
    createIdempotencyKey: () => string;
  },
): string {
  const draftKey = createMemoPlanRequestDraftKey({ userId, memoId });
  const restored = draftService.restore(draftKey, { sourceUpdatedAt });
  const request = PlanRequestPolicy.preparePlanRequest({
    previous: restored.status === 'restored' ? restored.value : null,
    input: { content, categoryId },
    createIdempotencyKey,
  });
  draftService.save(draftKey, request, { sourceUpdatedAt });
  return request.idempotencyKey;
}
