import { ANIMATION } from '@src/shared/constants/animation';
import { useResolvedColor } from '@src/shared/hooks/use-resolved-color';
import { useTranslation } from '@src/shared/i18n';
import { ChoiceRadio, HStack, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Card, Chip, RadioGroup } from 'heroui-native';
import type { ComponentProps } from 'react';
import Animated from 'react-native-reanimated';
import { match } from 'ts-pattern';

import { type SubscriptionPlan } from '../domains/subscription.model';
import { SubscriptionPolicy } from '../domains/subscription.model';
import { useGetOfferingsQueryOptions } from '../queries/subscription.queries';
import { formatPlanAmount } from '../utils/plan-price.view-model';
import { getFreeTrialPeriodLabelKey } from '../utils/subscription-label.view-model';

const AnimatedCard = Animated.createAnimatedComponent(Card);

type SubscriptionPlanInputProps = Omit<ComponentProps<typeof RadioGroup>, 'children'>;

export function SubscriptionPlanInput(props: SubscriptionPlanInputProps) {
  const { data: availability } = useSuspenseQuery(useGetOfferingsQueryOptions());
  const plans = availability.status === 'available' ? availability.offering.plans : [];
  const monthlyPlan = SubscriptionPolicy.findPlanByType(plans, 'monthly');
  const annualPlan = SubscriptionPolicy.findPlanByType(plans, 'annual');
  const annualDiscountPercent =
    monthlyPlan && annualPlan
      ? SubscriptionPolicy.getAnnualDiscountPercent(monthlyPlan, annualPlan)
      : 0;

  return (
    <RadioGroup className="gap-3" {...props}>
      {annualPlan && <PlanOption plan={annualPlan} discountPercent={annualDiscountPercent} />}
      {monthlyPlan && <PlanOption plan={monthlyPlan} />}
    </RadioGroup>
  );
}

interface PlanOptionProps {
  plan: SubscriptionPlan;
  /** 연간 요금제가 월간보다 싼 정도(%) */
  discountPercent?: number;
}

function PlanOption({ plan, discountPercent = 0 }: PlanOptionProps) {
  const { t } = useTranslation('subscription');
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
                {discountPercent > 0 && (
                  <PlanChip>{t('plan.discount', { percent: discountPercent })}</PlanChip>
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
