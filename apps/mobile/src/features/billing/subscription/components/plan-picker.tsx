import { useTrack } from '@src/shared/analytics';
import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { type QueryErrorFallbackProps, TextSkeleton, VStack } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { Card } from 'heroui-native';
import { type ComponentProps, useEffect } from 'react';
import { match } from 'ts-pattern';

import { type SubscriptionOffering } from '../domains/subscription.model';
import { SubscriptionPolicy } from '../domains/subscription.model';
import { useReportStoreUnavailable } from '../hooks/use-report-store-unavailable';
import { useSubscriptionView } from '../hooks/use-subscription-view';
import { useGetOfferingsQueryOptions } from '../queries/subscription.queries';
import type { StoreUnavailable } from '../utils/offerings-availability';
import {
  toSubscriptionLoadFailure,
  toSubscriptionStoreUnavailableFailure,
} from '../utils/subscription-failure.view-model';
import { SubscriptionPlanInput } from './subscription-plan-input';
import { SubscriptionResult } from './subscription-result';

const PLAN_ROW_COUNT = 2;

interface PlanPickerProps extends Omit<
  ComponentProps<typeof SubscriptionPlanInput>,
  'value' | 'onValueChange'
> {
  value: string | undefined;
  onValueChange: (planId: string) => void;
}

/** 스토어를 쓸 수 없으면 예상한 상태라 오류 경계 대신 요금제 자리에서 안내한다 */
export function PlanPicker(props: PlanPickerProps) {
  const { data: availability, refetch } = useSuspenseQuery(useGetOfferingsQueryOptions());

  return match(availability)
    .with({ status: 'available' }, ({ offering }) => (
      <PlanPicker.Plans offering={offering} {...props} />
    ))
    .with({ status: 'unavailable' }, ({ unavailable }) => (
      <StoreUnavailableFailure unavailable={unavailable} onRetry={() => refetch()} />
    ))
    .exhaustive();
}

PlanPicker.Plans = function Plans({
  offering,
  value,
  onValueChange,
  ...props
}: PlanPickerProps & { offering: SubscriptionOffering }) {
  const [view] = useSubscriptionView();
  const { trackEvent } = useTrack();

  // 요금제를 받아 실제로 보였을 때만 센다(게이트 → 구독하기 → 페이월 → 결제 퍼널). 못 받은 상태는 세지 않는다
  useEffect(() => {
    trackEvent('paywall_viewed', { view });
  }, [trackEvent, view]);

  return (
    <SubscriptionPlanInput
      value={SubscriptionPolicy.findSelectedPlan(offering, value)?.identifier}
      onValueChange={onValueChange}
      {...props}
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
          <Card key={index} className="flex-1 border-2 border-gray-2 bg-white dark:bg-gray-2">
            <VStack gap={8}>
              <TextSkeleton size="b3" className="w-16" />
              <TextSkeleton size="t2" className="w-28" />
              <TextSkeleton size="e1" className="w-24" />
            </VStack>
          </Card>
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

/** 안내를 실제로 보였을 때 관측을 남긴다(앱 실행마다 코드별 한 번) */
function StoreUnavailableFailure({
  unavailable,
  onRetry,
}: {
  unavailable: StoreUnavailable;
  onRetry: () => void;
}) {
  const reportStoreUnavailable = useReportStoreUnavailable();

  useEffect(() => {
    reportStoreUnavailable(unavailable);
  }, [reportStoreUnavailable, unavailable]);

  return (
    <SubscriptionResult.Failure
      failure={toSubscriptionStoreUnavailableFailure(unavailable)}
      onRetry={onRetry}
    />
  );
}
