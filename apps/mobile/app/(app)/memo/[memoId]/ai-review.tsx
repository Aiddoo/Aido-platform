import { MemoPlanReview } from '@src/features/notes/memo/components/memo-plan-review';
import { memoParamsSchema } from '@src/features/notes/memo/schemas/memo-params.schema';
import { PlanReview } from '@src/features/voice/components/plan/plan-review';
import { QueryErrorBoundary, ReadableContent, StyledSafeAreaView } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { Suspense } from 'react';

const PLAN_REVIEW_CLASS_NAME = 'flex-1 px-4 pb-3 pt-4';

export default function AiReviewRoute() {
  const params = memoParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/memo" />;
  }

  return (
    <StyledSafeAreaView edges={['left', 'right', 'bottom']} className="flex-1 bg-white">
      <ReadableContent flex={1}>
        <QueryErrorBoundary resetKeys={[params.data.memoId]}>
          <Suspense fallback={<PlanReview.Loading className={PLAN_REVIEW_CLASS_NAME} />}>
            <MemoPlanReview className={PLAN_REVIEW_CLASS_NAME} />
          </Suspense>
        </QueryErrorBoundary>
      </ReadableContent>
    </StyledSafeAreaView>
  );
}
