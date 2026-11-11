import { AmountDueToday } from '@src/features/billing/subscription/components/amount-due-today';
import { BenefitCarousel } from '@src/features/billing/subscription/components/benefit-carousel';
import { Paywall } from '@src/features/billing/subscription/components/paywall';
import { PlanComparisonTable } from '@src/features/billing/subscription/components/plan-comparison-table';
import { PlanPicker } from '@src/features/billing/subscription/components/plan-picker';
import { PremiumNotice } from '@src/features/billing/subscription/components/premium-notice';
import { PurchaseButton } from '@src/features/billing/subscription/components/purchase-button';
import { RestorePurchaseButton } from '@src/features/billing/subscription/components/restore-purchase-button';
import { SubscriptionOfflineActionsNotice } from '@src/features/billing/subscription/components/subscription-offline-actions-notice';
import { SubscriptionReceipt } from '@src/features/billing/subscription/components/subscription-receipt';
import { SubscriptionResult } from '@src/features/billing/subscription/components/subscription-result';
import { SubscriptionWelcome } from '@src/features/billing/subscription/components/subscription-welcome';
import { TrialTimeline } from '@src/features/billing/subscription/components/trial-timeline';
import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import type { SubscriptionPlan } from '@src/features/billing/subscription/domains/subscription.model';
import { useCheckoutRoute } from '@src/features/billing/subscription/hooks/use-checkout-route';
import { useOpenSubscriptionManagement } from '@src/features/billing/subscription/hooks/use-open-subscription-management';
import { useSubscriptionParams } from '@src/features/billing/subscription/hooks/use-subscription-params';
import { useSubscriptionReceipt } from '@src/features/billing/subscription/hooks/use-subscription-receipt';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import { useGetOfferingsQueryOptions } from '@src/features/billing/subscription/queries/subscription.queries';
import type { SubscriptionView } from '@src/features/billing/subscription/schemas/subscription-params.schema';
import { toSubscriptionLoadFailure } from '@src/features/billing/subscription/utils/subscription-failure.view-model';
import { PushPermissionToggle } from '@src/features/notification/components/push-permission-toggle';
import { useTrack } from '@src/shared/analytics';
import { formatYearAwareDateKeyLabel } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useStepper } from '@src/shared/hooks/use-stepper';
import { useTranslation } from '@src/shared/i18n';
import { useLocalDate } from '@src/shared/providers/local-date-provider';
import {
  Box,
  Button,
  DashedDivider,
  H2,
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  ReadableContent,
  ScallopedContainer,
  SettingsListGroup,
  Spacing,
  StyledSafeAreaView,
  Text,
  VStack,
} from '@src/shared/ui';
import { usePrefetchQuery, useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Suspense } from 'react';
import { ScrollView } from 'react-native';
import { match } from 'ts-pattern';

type CheckoutStepContexts = {
  status: Record<string, never>;
  welcome: { plan: SubscriptionPlan; purchasedOn: string; hadRewardOnly: boolean };
};

/** 결제가 끝나면 서버 반영과 상관없이 방금 산 요금제로 시작 화면을 보여 준다. 뒤로 가기로 결제 화면에 돌아가지 않는다 */
function SubscriptionScreen() {
  const { trackEvent } = useTrack();
  const { currentLocalDateKey } = useLocalDate();
  const stepper = useStepper<CheckoutStepContexts>({
    id: 'premium-checkout',
    initial: { step: 'status', context: {} },
    onStepChange: ({ step }) => trackEvent('checkout_step_viewed', { step }),
  });

  return (
    <stepper.Render
      status={({ history }) => (
        <SubscriptionScreen.Status
          onPurchased={({ plan, hadRewardOnly }) =>
            history.replace('welcome', { plan, purchasedOn: currentLocalDateKey, hadRewardOnly })
          }
        />
      )}
      welcome={({ context, history }) => (
        <SubscriptionScreen.Welcome
          {...context}
          onDone={() => (router.canGoBack() ? router.back() : history.replace('status', {}))}
        />
      )}
    />
  );
}

interface PurchaseFlowProps {
  onPurchased: (purchase: { plan: SubscriptionPlan; hadRewardOnly: boolean }) => void;
}

SubscriptionScreen.Status = function Status({ onPurchased }: PurchaseFlowProps) {
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
      <SubscriptionScreen.Plans onPurchased={onPurchased} />
    ))
    .with({ hasFullAccess: true }, () => <SubscriptionScreen.Receipt />)
    .exhaustive();
};

SubscriptionScreen.Plans = function Plans({ onPurchased }: PurchaseFlowProps) {
  const { t } = useTranslation('subscription');
  // 혜택·요금제·비교표가 형제 경계라 서로를 기다리지 않게 한 번에 시작한다
  usePrefetchQuery(useGetEntitlementsQueryOptions());
  usePrefetchQuery(useGetOfferingsQueryOptions());

  return (
    <Box className="flex-1" testID="subscription-paywall">
      <ScrollView className="flex-1 px-4" contentContainerClassName="pb-8">
        <StyledSafeAreaView edges={['left', 'right']}>
          <ReadableContent>
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

                <Paywall.BlockedFeature className="mb-4" />

                <QueryErrorBoundary fallback={BenefitCarousel.Error}>
                  <Suspense fallback={<BenefitCarousel.Loading />}>
                    <BenefitCarousel />
                  </Suspense>
                </QueryErrorBoundary>

                <Spacing size={24} />

                <QueryErrorBoundary fallback={PlanPicker.Error}>
                  <Suspense fallback={<PlanPicker.Loading />}>
                    <VStack gap={16}>
                      <PlanPicker />
                      <AmountDueToday className="px-1" />
                      <TrialTimeline reminder={TrialReminderToggle} />
                    </VStack>
                  </Suspense>
                </QueryErrorBoundary>

                <DashedDivider className="my-6" />

                <VStack gap={2}>
                  <Text size="b2" weight="bold" shade={9}>
                    {t('planComparison.title')}
                  </Text>
                  <Text size="e1" shade={6} lineBreakStrategyIOS="hangul-word">
                    {t('planComparison.hint')}
                  </Text>
                </VStack>

                <Spacing size={12} />

                <QueryErrorBoundary fallback={PlanComparisonTable.Error}>
                  <Suspense fallback={<PlanComparisonTable.Loading />}>
                    <PlanComparisonTable />
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
          </ReadableContent>
        </StyledSafeAreaView>
      </ScrollView>

      <StyledSafeAreaView edges={['left', 'right']} className="px-4 pb-4 pt-2">
        <ReadableContent>
          <PurchaseButton onPurchased={onPurchased} />
        </ReadableContent>
      </StyledSafeAreaView>
    </Box>
  );
};

interface WelcomeProps {
  plan: SubscriptionPlan;
  purchasedOn: string;
  hadRewardOnly: boolean;
  onDone: () => void;
}

SubscriptionScreen.Welcome = function Welcome({
  plan,
  purchasedOn,
  hadRewardOnly,
  onDone,
}: WelcomeProps) {
  const { t } = useTranslation('subscription');

  return (
    <Box className="flex-1">
      <ScrollView className="flex-1 px-4" contentContainerClassName="pb-8">
        <StyledSafeAreaView edges={['left', 'right']}>
          <ReadableContent>
            <Spacing size={24} />

            <SubscriptionWelcome
              plan={plan}
              purchasedOn={purchasedOn}
              hadRewardOnly={hadRewardOnly}
              reminder={TrialReminderToggle}
            />
          </ReadableContent>
        </StyledSafeAreaView>
      </ScrollView>

      <StyledSafeAreaView edges={['left', 'right']} className="px-4 pb-4 pt-2">
        <ReadableContent>
          <Button onPress={onDone} testID="subscription-welcome-done">
            {t('welcome.done')}
          </Button>
        </ReadableContent>
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
  const { pathname } = useCheckoutRoute();

  return (
    <ScrollView className="flex-1 px-4" contentContainerClassName="pb-8">
      <StyledSafeAreaView edges={['left', 'right']}>
        <ReadableContent>
          <Spacing size={16} />

          <PremiumNotice.Ending className="mb-3" />

          <SubscriptionReceipt />

          <Spacing size={16} />

          {match(primaryAction)
            .with('subscribe', () => (
              <Button
                onPress={() =>
                  push({
                    pathname,
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
        </ReadableContent>
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
        <ReadableContent>
          <Spacing size={16} />
          <SubscriptionReceipt.Loading />
        </ReadableContent>
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

/** billing은 알림 기능을 모르므로 체험 일정의 알림 칸은 화면이 알림 토글로 채운다 */
function TrialReminderToggle({ reminderDateKey }: { reminderDateKey: string }) {
  const { t } = useTranslation('notification');
  const { currentLocalDateKey } = useLocalDate();
  const date = formatYearAwareDateKeyLabel(
    reminderDateKey,
    currentLocalDateKey,
    useDateFormatContext(),
  );

  return (
    // 권한·알림 설정을 못 읽어도 요금제와 결제는 그대로 보이게 이 칸만 숨긴다
    <QueryErrorBoundary fallback={() => null}>
      <Suspense fallback={<SettingsListGroup.Toggle.Loading hasDescription />}>
        <PushPermissionToggle
          source="paywall"
          label={t('billingReminder.label')}
          descriptions={{
            on: t('billingReminder.on', { date }),
            off: t('billingReminder.off', { date }),
          }}
          className="px-1 py-0"
        />
      </Suspense>
    </QueryErrorBoundary>
  );
}

/** 마이 탭 구독 관리(`/settings/subscription`)와 업셀 모달(`/paywall`)이 같은 결제 흐름을 그린다 */
export function SubscriptionCheckout() {
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
