import { useErrorReporter, useHaptics, useLogger } from '@src/bootstrap/providers/di-context';
import { ERROR_REPORT_MESSAGES } from '@src/core/observability/telemetry-keys';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import { useTrack, useTrackView } from '@src/shared/analytics';
import { ANIMATION } from '@src/shared/constants/animation';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { useResolvedColor } from '@src/shared/hooks/use-resolved-color';
import { useTranslation } from '@src/shared/i18n';
import {
  ChoiceRadio,
  HStack,
  type QueryErrorFallbackProps,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { formatPercent } from '@src/shared/utils/number-format';
import { useSuspenseQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { Card, Chip, RadioGroup } from 'heroui-native';
import { type ComponentProps, useEffect } from 'react';
import Animated from 'react-native-reanimated';
import { match } from 'ts-pattern';

import { SUBSCRIPTION_LOG_EVENT } from '../constants/subscription-log-events';
import {
  type SubscriptionOffering,
  SubscriptionOfferingPolicy,
} from '../domains/subscription-offering.model';
import { getStoreUnavailableReport, type StoreUnavailable } from '../domains/subscription.error';
import { type SubscriptionPlan, SubscriptionPolicy } from '../domains/subscription.model';
import { useSelectedPlanId, useSubscriptionParams } from '../hooks/use-subscription-params';
import { useGetOfferingsQueryOptions } from '../queries/subscription.queries';
import { formatPlanAmount } from '../utils/plan-price.view-model';
import { getPremiumGateAnalyticsFeature } from '../utils/subscription-analytics';
import {
  getSubscriptionLoadFailure,
  getSubscriptionStoreUnavailableFailure,
} from '../utils/subscription-failure.view-model';
import { getFreeTrialPeriodLabelKey } from '../utils/subscription-label.view-model';
import { SubscriptionResult } from './subscription-result';

const PLAN_ROW_COUNT = 2;

const AnimatedCard = Animated.createAnimatedComponent(Card);

// 다시 시도·재진입마다 같은 설정 문제를 쌓지 않게 앱 실행마다 코드별로 한 번만 남긴다(보고자별로 센다)
const reportedStoreUnavailableCodes = new WeakMap<ErrorReporter, Set<string>>();

type PlanPickerProps = Omit<
  ComponentProps<typeof RadioGroup>,
  'children' | 'value' | 'onValueChange'
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

interface PlanPickerPlansProps extends PlanPickerProps {
  offering: SubscriptionOffering;
}

PlanPicker.Plans = function Plans({ offering, ...props }: PlanPickerPlansProps) {
  const [{ view, feature }] = useSubscriptionParams();
  const [selectedPlanId, setSelectedPlanId] = useSelectedPlanId();
  const { trackEvent } = useTrack();
  const haptics = useHaptics();
  const selectedPlan = SubscriptionOfferingPolicy.findSelectedPlan(offering, selectedPlanId);
  const monthlyPlan = SubscriptionOfferingPolicy.findPlanByType(offering, 'monthly');
  const annualPlan = SubscriptionOfferingPolicy.findPlanByType(offering, 'annual');

  // 요금제를 받아 실제로 보였을 때만 센다(게이트 → 프리미엄 보기 → 페이월 → 결제 퍼널). 못 받은 상태는 세지 않는다
  useTrackView('paywall_viewed', {
    // 같은 보기·기능으로 다시 그려질 때 두 번 세지 않는 키다. 막힌 기능 없이 연 페이월은 빈 칸이다
    key: `${view}:${feature ?? ''}`,
    params: {
      view,
      ...(feature != null && { feature: getPremiumGateAnalyticsFeature(feature) }),
    },
  });

  const handleValueChange = (planId: string) => {
    const nextPlan = SubscriptionOfferingPolicy.findSelectedPlan(offering, planId);
    if (nextPlan != null && nextPlan.identifier !== selectedPlan?.identifier) {
      haptics.selection();
      trackEvent('paywall_plan_selected', {
        plan_type: nextPlan.planType,
        is_trial: SubscriptionPolicy.hasFreeTrial(nextPlan),
      });
    }
    setSelectedPlanId(planId);
  };

  return (
    <RadioGroup
      className="gap-3"
      value={selectedPlan?.identifier}
      onValueChange={handleValueChange}
      {...props}
    >
      {annualPlan != null && (
        <PlanOption
          plan={annualPlan}
          discountPercent={
            monthlyPlan == null
              ? null
              : SubscriptionPolicy.getAnnualDiscountPercent(monthlyPlan, annualPlan)
          }
        />
      )}
      {monthlyPlan != null && <PlanOption plan={monthlyPlan} discountPercent={null} />}
    </RadioGroup>
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
      failure={getSubscriptionLoadFailure('plans', error)}
      onRetry={reset}
    />
  );
};

interface PlanOptionProps {
  plan: SubscriptionPlan;
  /** 연간 요금제가 월간보다 싼 정도(%). 견줄 월간이 없거나 월간이면 null이다 */
  discountPercent: number | null;
}

function PlanOption({ plan, discountPercent }: PlanOptionProps) {
  const { t } = useTranslation('subscription');
  const { locale } = useDateFormatContext();
  const selectedBorderColor = useResolvedColor('text-main');
  const idleBorderColor = useResolvedColor('text-gray-2');
  const { label, periodLabel, monthlyEquivalent } = match(plan.planType)
    .with('annual', () => ({
      label: t('plan.annual'),
      periodLabel: t('plan.perYear'),
      monthlyEquivalent: SubscriptionPolicy.getMonthlyEquivalent(plan),
    }))
    .with('monthly', () => ({
      label: t('plan.monthly'),
      periodLabel: t('plan.perMonth'),
      monthlyEquivalent: null,
    }))
    .exhaustive();

  return (
    <RadioGroup.Item value={plan.identifier} className="rounded-2xl">
      {({ isSelected }) => (
        // heroui Card가 style·ref를 넘겨 그대로 애니메이션 컴포넌트로 감싸고, 고른 테두리 색만 UI 스레드 CSS 전환으로 바꾼다
        <AnimatedCard
          className="flex-1 border-2 bg-white dark:bg-gray-2"
          style={{
            borderColor: isSelected ? selectedBorderColor : idleBorderColor,
            transitionProperty: 'borderColor',
            transitionDuration: ANIMATION.durationMs.fast,
            transitionTimingFunction: ANIMATION.easing.easeOut,
          }}
        >
          <VStack gap={8}>
            <HStack className="items-center justify-between">
              <HStack gap={8} className="items-center">
                <Text size="b3" weight="bold" className="text-gray-9">
                  {label}
                </Text>
                {discountPercent != null && discountPercent > 0 && (
                  <PlanChip>
                    {t('plan.discount', { percent: formatPercent(discountPercent, locale) })}
                  </PlanChip>
                )}
                {plan.freeTrial != null && (
                  <PlanChip testID="subscription-plan-free-trial">
                    {t('plan.freeTrial', {
                      period: t(getFreeTrialPeriodLabelKey(plan.freeTrial.periodUnit), {
                        count: plan.freeTrial.periodNumberOfUnits,
                      }),
                    })}
                  </PlanChip>
                )}
              </HStack>
              <ChoiceRadio />
            </HStack>

            <HStack className="items-baseline" gap={4}>
              <Text size="t2" weight="bold" className="text-gray-9">
                {plan.priceString}
              </Text>
              <Text size="b4" className="text-gray-5">
                {periodLabel}
              </Text>
            </HStack>

            {/* 가장 큰 가격은 실제 청구액이어야 해서(App Store 3.1.2) 월 환산가는 그 아래 강조로만 둔다 */}
            <Text
              size="b4"
              weight="semibold"
              tone="brand"
              className={cn(monthlyEquivalent == null && 'opacity-0')}
            >
              {monthlyEquivalent != null
                ? t('plan.monthlyEquivalent', {
                    price: formatPlanAmount(plan, monthlyEquivalent),
                  })
                : '\u00A0'}
            </Text>
          </VStack>
        </AnimatedCard>
      )}
    </RadioGroup.Item>
  );
}

/** Chip도 Pressable이라 그대로 두면 칩 자리 탭을 가로채 요금제가 골라지지 않는다 */
function PlanChip({
  children,
  ...props
}: Omit<ComponentProps<typeof Chip>, 'variant' | 'className' | 'pointerEvents'>) {
  return (
    <Chip
      size="sm"
      variant="soft"
      className="self-center bg-main/10"
      pointerEvents="none"
      {...props}
    >
      <Text size="e2" weight="bold" className="text-main">
        {children}
      </Text>
    </Chip>
  );
}

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
      failure={getSubscriptionStoreUnavailableFailure(unavailable)}
      onRetry={onRetry}
    />
  );
}

/** 스토어를 쓸 수 없다는 안내를 보였을 때 등급에 맞게 로그나 Sentry 메시지를 남긴다 */
function useReportStoreUnavailable() {
  const errorReporter = useErrorReporter();
  const logger = useLogger();

  return ({ kind, diagnosticCode }: StoreUnavailable) => {
    const reportedCodes = reportedStoreUnavailableCodes.get(errorReporter) ?? new Set<string>();
    if (reportedCodes.has(diagnosticCode)) {
      return;
    }
    reportedCodes.add(diagnosticCode);
    reportedStoreUnavailableCodes.set(errorReporter, reportedCodes);

    match(getStoreUnavailableReport(kind, { isDebugBuild: __DEV__ }))
      .with({ channel: 'log' }, () =>
        logger.warn(SUBSCRIPTION_LOG_EVENT.STORE_UNAVAILABLE, { kind, errorCode: diagnosticCode }),
      )
      .with({ channel: 'event' }, ({ severity }) =>
        errorReporter.captureMessage(ERROR_REPORT_MESSAGES.SUBSCRIPTION_STORE_UNAVAILABLE, {
          feature: 'subscription',
          severity,
          errorCode: diagnosticCode,
        }),
      )
      .exhaustive();
  };
}
