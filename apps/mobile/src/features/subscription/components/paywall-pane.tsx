import { useTrack } from '@src/shared/analytics';
import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  DashedDivider,
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  ScallopedContainer,
  Spacing,
  StyledSafeAreaView,
  VStack,
} from '@src/shared/ui';
import { useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { router } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { Suspense, useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { match } from 'ts-pattern';

import { getSelectedPlan, type SubscriptionOffering } from '../domains/subscription.model';
import { useSubscriptionViewParam } from '../hooks/use-subscription-view-param';
import { useGetOfferingsQueryOptions } from '../queries/get-offerings-query-options';
import { usePurchaseMutationOptions } from '../queries/use-purchase-mutation-options';
import {
  toSubscriptionLoadFailure,
  toSubscriptionStoreUnavailableFailure,
} from '../utils/view-models/subscription-failure.view-model';
import { Paywall } from './paywall';
import { PremiumNotice } from './premium-notice';
import { RestorePurchaseButton } from './restore-purchase-button';
import { SubscriptionOfflineActionsNotice } from './subscription-offline-actions-notice';
import { SubscriptionPlanInput } from './subscription-plan-input';
import { SubscriptionResult } from './subscription-result';

const PLAN_ROW_COUNT = 2;

/** 무료 사용자(또는 보상 기간에 구독을 이어 붙이려는 사람)의 요금제 화면. 요금제 자리와 구독 버튼만 스토어 상태를 따른다 */
export function PaywallPane() {
  const [chosenPlanId, setChosenPlanId] = useState<string>();

  return (
    <Box className="flex-1" testID="subscription-paywall">
      <ScrollView className="flex-1 px-4" contentContainerClassName="pb-8">
        <StyledSafeAreaView edges={['left', 'right']}>
          <Spacing size={16} />

          <PremiumNotice.GrantEnded />

          <ScallopedContainer>
            <Paywall />

            <DashedDivider className="my-5 mx-5" />

            <Box className="px-5 pb-5">
              <QueryErrorBoundary fallback={PlanPicker.Error}>
                <Suspense fallback={<PlanPicker.Loading />}>
                  <PlanPicker chosenPlanId={chosenPlanId} onChoose={setChosenPlanId} />
                </Suspense>
              </QueryErrorBoundary>
            </Box>
          </ScallopedContainer>

          <Spacing size={24} />

          <VStack gap={8} className="items-center">
            <Paywall.RenewalNotice />
            <Paywall.Terms />
            <RestorePurchaseButton size="small" />
          </VStack>
        </StyledSafeAreaView>
      </ScrollView>

      <StyledSafeAreaView edges={['left', 'right']} className="px-4 pb-4 pt-2">
        <PurchaseButton chosenPlanId={chosenPlanId} />
      </StyledSafeAreaView>
    </Box>
  );
}

interface PlanPickerProps {
  chosenPlanId: string | undefined;
  onChoose: (planId: string) => void;
}

/** 스토어를 쓸 수 없으면 예상한 상태라 오류 경계 대신 요금제 자리에서 안내한다 */
function PlanPicker(props: PlanPickerProps) {
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
  const [view] = useSubscriptionViewParam();
  const { trackEvent } = useTrack();

  // 요금제를 받아 실제로 보였을 때만 센다(게이트 → 구독하기 → 페이월 → 결제 퍼널). 못 받은 상태는 세지 않는다
  useEffect(() => {
    trackEvent('paywall_viewed', { view });
  }, [trackEvent, view]);

  return (
    <SubscriptionPlanInput
      value={getSelectedPlan(offering, chosenPlanId)?.identifier}
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
        {times(PLAN_ROW_COUNT, (index) => (
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

function PurchaseButton({ chosenPlanId }: { chosenPlanId: string | undefined }) {
  const { t } = useTranslation('subscription');
  const purchase = useMutation(usePurchaseMutationOptions());
  const [view] = useSubscriptionViewParam();
  const isOnline = useIsOnline();
  // 요금제 자리의 경계 밖이라 실패를 던지지 않는다. 요금제를 받기 전에는 버튼만 잠긴다
  const { data: availability } = useQuery({
    ...useGetOfferingsQueryOptions(),
    throwOnError: false,
  });
  const selectedPlan =
    availability?.status === 'available'
      ? getSelectedPlan(availability.offering, chosenPlanId)
      : undefined;

  const handlePurchase = () => {
    if (!selectedPlan || purchase.isPending) {
      return;
    }
    purchase.mutate(selectedPlan.identifier, {
      // 보상 영수증에서 요금제로 들어왔으면 영수증으로 돌아가 결제한 영수증으로 바뀌는 것을 보여 준다
      onSuccess: () => {
        if (view === 'plans' && router.canGoBack()) {
          router.back();
        }
      },
    });
  };

  return (
    <>
      {!isOnline && (
        <Box className="pb-2">
          <SubscriptionOfflineActionsNotice />
        </Box>
      )}
      <Button
        onPress={handlePurchase}
        isLoading={purchase.isPending}
        isDisabled={!selectedPlan || purchase.isPending || !isOnline}
        testID="subscription-purchase"
      >
        {t('paywall.subscribeButton')}
      </Button>
    </>
  );
}
