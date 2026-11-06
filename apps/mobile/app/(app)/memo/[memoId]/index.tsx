import { MemoEditor } from '@src/features/memo/components/memo-editor';
import { memoScreenParamsSchema } from '@src/features/memo/hooks/use-memo-params';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { QueryErrorBoundary, StyledSafeAreaView } from '@src/shared/ui';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Suspense } from 'react';

export default function MemoDetailRoute() {
  const params = memoScreenParamsSchema.safeParse(useLocalSearchParams());
  const goBack = useSingleTap(router.back);

  if (!params.success) {
    return <Redirect href="/memo" />;
  }

  return (
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1 bg-white">
      <QueryErrorBoundary resetKeys={[params.data.memoId]} fallback={MemoEditor.Error}>
        <Suspense fallback={<MemoEditor.Loading />}>
          <MemoEditor toolbar={MemoEditor.StackToolbar} onLeave={goBack} />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}
