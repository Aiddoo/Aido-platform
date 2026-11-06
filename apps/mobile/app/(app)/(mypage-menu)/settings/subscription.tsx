import { PaywallPane } from '@src/features/subscription/components/paywall-pane';
import { SubscriberPane } from '@src/features/subscription/components/subscriber-pane';
import { SubscriptionReceipt } from '@src/features/subscription/components/subscription-receipt';
import { SubscriptionResult } from '@src/features/subscription/components/subscription-result';
import { EntitlementPolicy } from '@src/features/subscription/domains/entitlement.model';
import { useSubscriptionReceipt } from '@src/features/subscription/hooks/use-subscription-receipt';
import { useSubscriptionViewParam } from '@src/features/subscription/hooks/use-subscription-view-param';
import { useGetEntitlementsQueryOptions } from '@src/features/subscription/queries/get-entitlements-query-options';
import { toSubscriptionLoadFailure } from '@src/features/subscription/utils/view-models/subscription-failure.view-model';
import { useIsOnline } from '@src/shared/hooks/use-is-online';
import {
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  ReadableContent,
  Spacing,
  StyledSafeAreaView,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Suspense } from 'react';
import { ScrollView } from 'react-native';
import { match } from 'ts-pattern';

function SubscriptionScreen() {
  const { data: entitlements } = useSuspenseQuery(useGetEntitlementsQueryOptions());
  const receipt = useSubscriptionReceipt();
  const [view] = useSubscriptionViewParam();

  // 보상 기간만 있으면 끝나기 전에 구독을 이어 붙일 수 있게 요금제를 보여 준다.
  // 영수증은 서버 값으로만 그려 스토어가 실패해도 이용 중인 사람(관리자 포함)은 영수증을 본다.
  return match({
    hasFullAccess: EntitlementPolicy.hasFullAccess(entitlements),
    canSubscribe: receipt.primaryAction === 'subscribe',
    view,
  })
    .with({ canSubscribe: true, view: 'plans' }, { hasFullAccess: false }, () => <PaywallPane />)
    .with({ hasFullAccess: true }, () => <SubscriberPane />)
    .exhaustive();
}

SubscriptionScreen.Loading = function Loading() {
  const isOnline = useIsOnline();

  // 오프라인이면 조회가 멈춰 스켈레톤이 끝나지 않는다. 연결되면 멈춘 조회가 이어서 화면을 채운다
  if (!isOnline) {
    return (
      <StyledSafeAreaView edges={['left', 'right']} className="flex-1">
        <ReadableContent className="flex-1 px-6">
          <SubscriptionResult.Offline target="receipt" />
        </ReadableContent>
      </StyledSafeAreaView>
    );
  }

  return (
    <ScrollView className="flex-1 px-4" contentContainerClassName="pb-8" scrollEnabled={false}>
      <StyledSafeAreaView edges={['left', 'right']} accessibilityState={{ busy: true }}>
        <Spacing size={16} />
        <SubscriptionReceipt.Loading />
      </StyledSafeAreaView>
    </ScrollView>
  );
};

SubscriptionScreen.Error = function ErrorFallback({ error, reset }: QueryErrorFallbackProps) {
  return (
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1">
      <ReadableContent className="flex-1 px-6">
        <SubscriptionResult.Failure
          failure={toSubscriptionLoadFailure('receipt', error)}
          onRetry={reset}
        />
      </ReadableContent>
    </StyledSafeAreaView>
  );
};

export default function SubscriptionRoute() {
  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <QueryErrorBoundary fallback={SubscriptionScreen.Error}>
        <Suspense fallback={<SubscriptionScreen.Loading />}>
          <SubscriptionScreen />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}
