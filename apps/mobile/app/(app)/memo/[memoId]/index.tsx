import { MemoEditor } from '@src/features/notes/memo/components/memo-editor';
import { useMemoId } from '@src/features/notes/memo/hooks/use-memo-params';
import { memoParamsSchema } from '@src/features/notes/memo/schemas/memo-params.schema';
import { useGoBack } from '@src/shared/hooks/use-go-back';
import { useRouteParamsOrRedirect } from '@src/shared/hooks/use-route-params-or-redirect';
import { QueryErrorBoundary, StyledSafeAreaView } from '@src/shared/ui';
import { Suspense } from 'react';

export default function MemoDetailRoute() {
  const route = useRouteParamsOrRedirect(memoParamsSchema, { fallbackHref: '/memo' });

  if (route.redirect != null) {
    return route.redirect;
  }

  return <MemoDetailScreen />;
}

function MemoDetailScreen() {
  const [memoId] = useMemoId();
  const goBack = useGoBack({ fallbackHref: '/memo' });

  return (
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1 bg-white">
      <QueryErrorBoundary resetKeys={[memoId]} fallback={MemoEditor.Error}>
        <Suspense fallback={<MemoEditor.Loading />}>
          <MemoEditor toolbar={MemoEditor.StackToolbar} onLeave={goBack} />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}
