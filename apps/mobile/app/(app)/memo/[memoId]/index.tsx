import { MemoEditor } from '@src/features/notes/memo/components/memo-editor';
import { useMemoId } from '@src/features/notes/memo/hooks/use-memo-params';
import { memoParamsSchema } from '@src/features/notes/memo/schemas/memo-params.schema';
import { useGoBack } from '@src/shared/hooks/use-go-back';
import { useRouteParamsOrRedirect } from '@src/shared/hooks/use-route-params-or-redirect';
import { QueryErrorBoundary, StyledSafeAreaView } from '@src/shared/ui';
import { useNavigation } from 'expo-router';
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
  const navigation = useNavigation();
  const goBack = useGoBack({ fallbackHref: '/memo' });

  // 저장·삭제·옮기기를 기다리는 사이 밀어서 떠났다면 지금 화면이 이전 화면이므로 또 뒤로 가지 않는다
  const leaveIfFocused = () => {
    if (navigation.isFocused()) {
      goBack();
    }
  };

  return (
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1 bg-white">
      <QueryErrorBoundary resetKeys={[memoId]} fallback={MemoEditor.Error}>
        <Suspense fallback={<MemoEditor.Loading />}>
          <MemoEditor toolbar={MemoEditor.StackToolbar} onLeave={leaveIfFocused} />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}
