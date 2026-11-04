import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { type QueryErrorFallbackProps, StyledSafeAreaView } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Spinner } from 'heroui-native';
import { match } from 'ts-pattern';

import { useGetOfferingsQueryOptions } from '../queries/get-offerings-query-options';
import { toSubscriptionLoadFailure } from '../utils/view-models/subscription-failure.view-model';
import { Paywall } from './paywall';
import { SubscriptionResult } from './subscription-result';
import { SubscriptionStoreUnavailable } from './subscription-store-unavailable';

/** 요금제를 스토어에서 받아 페이월을 그린다. 스토어를 쓸 수 없으면 예상한 상태라 오류 경계 대신 안내한다 */
export function PaywallPane() {
  const {
    data: availability,
    refetch,
    isRefetching,
  } = useSuspenseQuery(useGetOfferingsQueryOptions());

  return match(availability)
    .with({ status: 'available' }, ({ offering }) => <Paywall offering={offering} />)
    .with({ status: 'unavailable' }, ({ unavailable }) => (
      <SubscriptionStoreUnavailable
        unavailable={unavailable}
        onRetry={() => refetch()}
        isRetrying={isRefetching}
      />
    ))
    .exhaustive();
}

/** 요금제는 스토어에서 받아 모양이 정해지지 않아 가운데 표시기만 둔다 */
PaywallPane.Loading = function Loading() {
  const isOnline = useIsOnline();

  if (!isOnline) {
    return <SubscriptionResult.Offline target="plans" />;
  }

  return (
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1 items-center justify-center">
      <Spinner size="lg" color="default" />
    </StyledSafeAreaView>
  );
};

/** 스토어에서 요금제를 받지 못해도 빈 화면 대신 다시 시도와 문의를 보여 준다 */
PaywallPane.Error = function ErrorFallback({ error, reset }: QueryErrorFallbackProps) {
  return (
    <SubscriptionResult.Failure
      failure={toSubscriptionLoadFailure('plans', error)}
      onRetry={reset}
    />
  );
};
