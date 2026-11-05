import { PlanRequestPolicy } from '@src/features/voice/domains/plan-request.model';
import { createPlanReviewDraftKey } from '@src/features/voice/domains/plan-review-form.schema';
import { createDraftKey } from '@src/shared/draft/draft.model';
import type { DraftService } from '@src/shared/draft/draft.service';
import { z } from 'zod';

/** 메모를 할 일로 나눈 결과(고친 카드 포함). 메모가 바뀌면 복원할 때 버려진다 */
export function createMemoPlanDraftKey({ userId, memoId }: { userId: string; memoId: number }) {
  return createPlanReviewDraftKey({ userId, scope: 'memo-plan', target: [memoId] });
}

const memoPlanRequestDraftSchema = z.object({
  fingerprint: z.string(),
  idempotencyKey: z.string(),
  input: z.object({ content: z.string(), categoryId: z.int() }),
});

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

/** 같은 메모의 재시도면 남겨 둔 키를, 메모가 바뀌었거나 처음이면 새 키를 쓴다 */
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
