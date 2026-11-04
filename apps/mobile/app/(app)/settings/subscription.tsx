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
  // 스토어를 쓸 수 없으면 요금제 자리에서 안내한다.
  return match({
    hasFullAccess: EntitlementPolicy.hasFullAccess(entitlements),
    canSubscribe: receipt.primaryAction === 'subscribe',
    view,
  })
    .with({ canSubscribe: true, view: 'plans' }, { hasFullAccess: false }, () => (
      <QueryErrorBoundary fallback={PaywallPane.Error}>
        <Suspense fallback={<PaywallPane.Loading />}>
          <PaywallPane />
        </Suspense>
      </QueryErrorBoundary>
    ))
    .with({ hasFullAccess: true }, () => <SubscriberPane />)
    .exhaustive();
}

/** 내 정보·권한을 받기 전에는 영수증과 같은 자리·모양의 스켈레톤을 둔다 */
SubscriptionScreen.Loading = function Loading() {
  const isOnline = useIsOnline();

  // 오프라인이면 조회가 멈춰 스켈레톤이 끝나지 않는다. 연결되면 멈춘 조회가 이어서 화면을 채운다
  if (!isOnline) {
    return <SubscriptionResult.Offline target="receipt" />;
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

/** 내 정보·권한을 불러오지 못하면 영수증도 요금제도 정할 수 없어 화면 전체에서 안내한다 */
SubscriptionScreen.Error = function ErrorFallback({ error, reset }: QueryErrorFallbackProps) {
  return (
    <SubscriptionResult.Failure
      failure={toSubscriptionLoadFailure('receipt', error)}
      onRetry={reset}
    />
  );
};

export default function SubscriptionRoute() {
  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <QueryErrorBoundary fallback={SubscriptionScreen.Error}>
        <Suspense fallback={<SubscriptionScreen.Loading />}>
          <SubscriptionScreen />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}
