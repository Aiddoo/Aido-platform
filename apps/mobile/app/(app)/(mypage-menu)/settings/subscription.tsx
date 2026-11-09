import { Paywall } from '@src/features/billing/subscription/components/paywall';
import { PlanPicker } from '@src/features/billing/subscription/components/plan-picker';
import { PremiumNotice } from '@src/features/billing/subscription/components/premium-notice';
import { PurchaseButton } from '@src/features/billing/subscription/components/purchase-button';
import { RestorePurchaseButton } from '@src/features/billing/subscription/components/restore-purchase-button';
import { SubscriptionOfflineActionsNotice } from '@src/features/billing/subscription/components/subscription-offline-actions-notice';
import { SubscriptionReceipt } from '@src/features/billing/subscription/components/subscription-receipt';
import { SubscriptionResult } from '@src/features/billing/subscription/components/subscription-result';
import { TrialTimeline } from '@src/features/billing/subscription/components/trial-timeline';
import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useOpenSubscriptionManagement } from '@src/features/billing/subscription/hooks/use-open-subscription-management';
import { useSubscriptionParams } from '@src/features/billing/subscription/hooks/use-subscription-params';
import { useSubscriptionReceipt } from '@src/features/billing/subscription/hooks/use-subscription-receipt';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import type { SubscriptionView } from '@src/features/billing/subscription/schemas/subscription-params.schema';
import { toSubscriptionLoadFailure } from '@src/features/billing/subscription/utils/subscription-failure.view-model';
import { InvitePawPrintBoard } from '@src/features/social/invite/components/invite-paw-print-board';
import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  DashedDivider,
  H2,
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  ReadableContent,
  ScallopedContainer,
  Spacing,
  StyledSafeAreaView,
  Text,
  VStack,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Suspense, useState } from 'react';
import { ScrollView } from 'react-native';
import { match } from 'ts-pattern';

function SubscriptionScreen() {
  const { data: entitlements } = useSuspenseQuery(useGetEntitlementsQueryOptions());
  const receipt = useSubscriptionReceipt();
  const [{ view }] = useSubscriptionParams();

  // 보상 기간만 있으면 끝나기 전에 구독을 이어 붙일 수 있게 요금제를 보여 준다.
  // 영수증은 서버 값으로만 그려 스토어가 실패해도 이용 중인 사람(관리자 포함)은 영수증을 본다.
  return match({
    hasFullAccess: EntitlementPolicy.hasFullAccess(entitlements),
    canSubscribe: receipt.primaryAction === 'subscribe',
    view,
  })
    .with({ canSubscribe: true, view: 'plans' }, { hasFullAccess: false }, () => (
      <SubscriptionScreen.Plans />
    ))
    .with({ hasFullAccess: true }, () => <SubscriptionScreen.Receipt />)
    .exhaustive();
}

SubscriptionScreen.Plans = function Plans() {
  const { t } = useTranslation('subscription');
  const [{ feature }] = useSubscriptionParams();
  const [chosenPlanId, setChosenPlanId] = useState<string>();

  // 막혀서 들어왔으면 그 기능을 먼저 보이고, 고를 요금제를 혜택 그림보다 위에 둔다
  return (
    <Box className="flex-1" testID="subscription-paywall">
      <ScrollView className="flex-1 px-4" contentContainerClassName="pb-8">
        <StyledSafeAreaView edges={['left', 'right']}>
          <Spacing size={16} />

          <PremiumNotice.GrantEnded className="mb-3" />

          <ScallopedContainer>
            <Box className="p-5">
              <VStack gap={4} align="center">
                <H2>{t('paywall.title')}</H2>

                <Text size="b3" shade={6} lineBreakStrategyIOS="hangul-word">
                  {t('paywall.subtitle')}
                </Text>
              </VStack>

              <Spacing size={20} />

              {feature != null && (
                <>
                  <Paywall.BlockedFeature feature={feature} />
                  <Spacing size={16} />
                </>
              )}

              <QueryErrorBoundary fallback={PlanPicker.Error}>
                <Suspense fallback={<PlanPicker.Loading />}>
                  <PlanPicker value={chosenPlanId} onValueChange={setChosenPlanId} />
                  <TrialTimeline planId={chosenPlanId} className="mt-3" />
                </Suspense>
              </QueryErrorBoundary>

              <DashedDivider className="my-6" />

              <Paywall />

              <Spacing size={20} />

              <Paywall.AdditionalBenefits />

              <Spacing size={8} />

              <Text size="e2" shade={5} align="center" lineBreakStrategyIOS="hangul-word">
                {t('paywall.futureIncluded')}
              </Text>
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
        <PurchaseButton planId={chosenPlanId} />
      </StyledSafeAreaView>
    </Box>
  );
};

SubscriptionScreen.Receipt = function Receipt() {
  const { t } = useTranslation('subscription');
  const { primaryAction } = useSubscriptionReceipt();
  const openSubscriptionManagement = useOpenSubscriptionManagement();
  const isOnline = useIsOnline();
  const push = useSingleTap(router.push);

  return (
    <ScrollView className="flex-1 px-4" contentContainerClassName="pb-8">
      <StyledSafeAreaView edges={['left', 'right']}>
        <Spacing size={16} />

        <PremiumNotice.Ending className="mb-3" />

        <SubscriptionReceipt rewardStamp={<InvitePawPrintBoard.Stamp />} />

        <Spacing size={16} />

        {match(primaryAction)
          .with('subscribe', () => (
            <Button
              onPress={() =>
                push({
                  pathname: '/settings/subscription',
                  params: { view: 'plans' satisfies SubscriptionView },
                })
              }
            >
              {t('subscriber.subscribeAfterGrantButton')}
            </Button>
          ))
          .with('manage', () => (
            <Button onPress={openSubscriptionManagement} variant="weak" color="dark">
              {t('subscriber.manageButton')}
            </Button>
          ))
          .with(null, () => null)
          .exhaustive()}

        <Spacing size={16} />

        <VStack gap={8} className="items-center">
          <RestorePurchaseButton size="medium" />
          {!isOnline && <SubscriptionOfflineActionsNotice />}
        </VStack>
      </StyledSafeAreaView>
    </ScrollView>
  );
};

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
