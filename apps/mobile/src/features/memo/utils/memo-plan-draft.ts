import { createPlanReviewDraftKey } from '@src/features/voice/domains/plan-review-form.schema';

/** 메모를 할 일로 나눈 결과(고친 카드 포함). 메모가 바뀌면 복원할 때 버려진다 */
export function createMemoPlanDraftKey({ userId, memoId }: { userId: string; memoId: number }) {
  return createPlanReviewDraftKey({ userId, scope: 'memo-plan', target: [memoId] });
}
