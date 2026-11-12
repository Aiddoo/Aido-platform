import { useHaptics } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { useResolvedColor } from '@src/shared/hooks/use-resolved-color';
import { type QueryErrorFallbackProps, TextSkeleton, VStack } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { Card } from 'heroui-native';
import { type ComponentProps, useEffect } from 'react';
import { match } from 'ts-pattern';

import { type SubscriptionOffering } from '../domains/subscription.model';
import { hasFreeTrial, SubscriptionPolicy } from '../domains/subscription.model';
import { useReportStoreUnavailable } from '../hooks/use-report-store-unavailable';
import { useSelectedPlanId, useSubscriptionParams } from '../hooks/use-subscription-params';
import { useGetOfferingsQueryOptions } from '../queries/subscription.queries';
import type { StoreUnavailable } from '../utils/offerings-availability';
import { getPremiumGateAnalyticsFeature } from '../utils/subscription-analytics';
import {
  toSubscriptionLoadFailure,
  toSubscriptionStoreUnavailableFailure,
} from '../utils/subscription-failure.view-model';
import { SubscriptionPlanInput } from './subscription-plan-input';
import { SubscriptionResult } from './subscription-result';

const PLAN_ROW_COUNT = 2;

type PlanPickerProps = Omit<
  ComponentProps<typeof SubscriptionPlanInput>,
  'value' | 'onValueChange'
>;

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
  ...props
}: PlanPickerProps & { offering: SubscriptionOffering }) {
  const [{ view, feature }] = useSubscriptionParams();
  const [selectedPlanId, setSelectedPlanId] = useSelectedPlanId();
  const { trackEvent } = useTrack();
  const haptics = useHaptics();
  const selectedPlan = SubscriptionPolicy.findSelectedPlan(offering, selectedPlanId);

  // 요금제를 받아 실제로 보였을 때만 센다(게이트 → 프리미엄 보기 → 페이월 → 결제 퍼널). 못 받은 상태는 세지 않는다
  useEffect(() => {
    trackEvent('paywall_viewed', {
      view,
      ...(feature != null && { feature: getPremiumGateAnalyticsFeature(feature) }),
    });
  }, [trackEvent, view, feature]);

  const handleValueChange = (planId: string) => {
    const nextPlan = SubscriptionPolicy.findSelectedPlan(offering, planId);
    if (nextPlan != null && nextPlan.identifier !== selectedPlan?.identifier) {
      haptics.selection();
      trackEvent('paywall_plan_selected', {
        plan_type: nextPlan.planType,
        is_trial: hasFreeTrial(nextPlan.freeTrial),
      });
    }
    setSelectedPlanId(planId);
  };

  return (
    <SubscriptionPlanInput
      value={selectedPlan?.identifier}
      onValueChange={handleValueChange}
      {...props}
    />
  );
};

/** 오프라인이면 조회가 멈춰 스켈레톤이 끝나지 않는다. 연결되면 멈춘 조회가 이어서 요금제를 채운다 */
PlanPicker.Loading = function Loading() {
  const isOnline = useIsOnline();
  // 다크에서 카드 바탕(gray-2)과 기본 글 스켈레톤 색이 같아 한 단계 밝은 색으로 그린다
  const color = useResolvedColor('text-gray-3');

  return match(isOnline)
    .with(false, () => <SubscriptionResult.Offline target="plans" />)
    .with(true, () => (
      <VStack gap={12} accessibilityState={{ busy: true }} testID="subscription-paywall-loading">
        {range(PLAN_ROW_COUNT).map((index) => (
          <Card key={index} className="flex-1 border-2 border-gray-2 bg-white dark:bg-gray-2">
            <VStack gap={8}>
              <TextSkeleton size="b3" color={color} className="w-16" />
              <TextSkeleton size="t2" color={color} className="w-28" />
              <TextSkeleton size="b4" color={color} className="w-24" />
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
