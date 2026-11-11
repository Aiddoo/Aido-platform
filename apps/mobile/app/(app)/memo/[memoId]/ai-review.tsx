import { MemoPlanReview } from '@src/features/notes/memo/components/memo-plan-review';
import { useMemoId } from '@src/features/notes/memo/hooks/use-memo-params';
import { memoParamsSchema } from '@src/features/notes/memo/schemas/memo-params.schema';
import { useRouteParamsOrRedirect } from '@src/shared/hooks/use-route-params-or-redirect';
import { Box, QueryErrorBoundary, ReadableContent, StyledSafeAreaView } from '@src/shared/ui';
import { Suspense } from 'react';

export default function AiReviewRoute() {
  const route = useRouteParamsOrRedirect(memoParamsSchema, { fallbackHref: '/memo' });

  if (route.redirect != null) {
    return route.redirect;
  }

  return <AiReviewScreen />;
}

function AiReviewScreen() {
  const [memoId] = useMemoId();

  return (
    <StyledSafeAreaView edges={['left', 'right', 'bottom']} className="flex-1 bg-white">
      <ReadableContent flex={1}>
        <QueryErrorBoundary resetKeys={[memoId]} fallback={MemoPlanReview.Error}>
          <Box className="flex-1 px-4 pb-3 pt-4">
            <Suspense fallback={<MemoPlanReview.Loading />}>
              <MemoPlanReview />
            </Suspense>
          </Box>
        </QueryErrorBoundary>
      </ReadableContent>
    </StyledSafeAreaView>
  );
}
