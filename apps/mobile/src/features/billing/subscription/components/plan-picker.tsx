import { useTrack } from '@src/shared/analytics';
import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { type QueryErrorFallbackProps, VStack } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { Skeleton } from 'heroui-native';
import { useEffect } from 'react';
import { match } from 'ts-pattern';

import { SubscriptionPolicy } from '../domains/subscription.model';
import { useSubscriptionViewParam } from '../hooks/use-subscription-view-param';
import { useGetOfferingsQueryOptions } from '../queries/subscription.queries';
import { type SubscriptionOffering } from '../schemas/subscription.schema';
import {
  toSubscriptionLoadFailure,
  toSubscriptionStoreUnavailableFailure,
} from '../utils/subscription-failure.view-model';
import { SubscriptionPlanInput } from './subscription-plan-input';
import { SubscriptionResult } from './subscription-result';

const PLAN_ROW_COUNT = 2;

interface PlanPickerProps {
  chosenPlanId: string | undefined;
  onChoose: (planId: string) => void;
}

/** 스토어를 쓸 수 없으면 예상한 상태라 오류 경계 대신 요금제 자리에서 안내한다 */
export function PlanPicker(props: PlanPickerProps) {
  const { data: availability, refetch } = useSuspenseQuery(useGetOfferingsQueryOptions());

  return match(availability)
    .with({ status: 'available' }, ({ offering }) => (
      <PlanPicker.Plans offering={offering} {...props} />
    ))
    .with({ status: 'unavailable' }, ({ unavailable }) => (
      <SubscriptionResult.Failure
        failure={toSubscriptionStoreUnavailableFailure(unavailable)}
        onRetry={() => refetch()}
      />
    ))
    .exhaustive();
}

PlanPicker.Plans = function Plans({
  offering,
  chosenPlanId,
  onChoose,
}: PlanPickerProps & { offering: SubscriptionOffering }) {
  const view = useSubscriptionViewParam();
  const { trackEvent } = useTrack();

  // 요금제를 받아 실제로 보였을 때만 센다(게이트 → 구독하기 → 페이월 → 결제 퍼널). 못 받은 상태는 세지 않는다
  useEffect(() => {
    trackEvent('paywall_viewed', { view });
  }, [trackEvent, view]);

  return (
    <SubscriptionPlanInput
      value={SubscriptionPolicy.getSelectedPlan(offering, chosenPlanId)?.identifier}
      onValueChange={onChoose}
    />
  );
};

/** 오프라인이면 조회가 멈춰 스켈레톤이 끝나지 않는다. 연결되면 멈춘 조회가 이어서 요금제를 채운다 */
PlanPicker.Loading = function Loading() {
  const isOnline = useIsOnline();

  return match(isOnline)
    .with(false, () => <SubscriptionResult.Offline target="plans" />)
    .with(true, () => (
      <VStack gap={12} accessibilityState={{ busy: true }} testID="subscription-paywall-loading">
        {range(PLAN_ROW_COUNT).map((index) => (
          <Skeleton key={index} className="h-16 rounded-2xl dark:bg-gray-2" />
        ))}
      </VStack>
    ))
    .exhaustive();
};

PlanPicker.Error = function ErrorFallback({ error, reset }: QueryErrorFallbackProps) {
  return (
    <SubscriptionResult.Failure
      failure={toSubscriptionLoadFailure('plans', error)}
      onRetry={reset}
    />
  );
};
