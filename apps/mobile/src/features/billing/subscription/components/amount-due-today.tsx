import { ANIMATION } from '@src/shared/constants/animation';
import { useTranslation } from '@src/shared/i18n';
import { HStack, Text, TextSkeleton } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { SubscriptionPolicy } from '../domains/subscription.model';
import { useSelectedPlanId } from '../hooks/use-subscription-params';
import { useGetOfferingsQueryOptions } from '../queries/subscription.queries';
import { formatPlanAmount } from '../utils/plan-price.view-model';

const AMOUNT_ENTERING = FadeIn.duration(ANIMATION.duration.fast).reduceMotion(ReduceMotion.System);

export function AmountDueToday(props: Omit<ComponentProps<typeof HStack>, 'children'>) {
  const { t } = useTranslation('subscription');
  const [planId] = useSelectedPlanId();
  const { data: availability } = useSuspenseQuery(useGetOfferingsQueryOptions());
  const plan =
    availability.status === 'available'
      ? SubscriptionPolicy.findSelectedPlan(availability.offering, planId)
      : null;

  if (plan == null) {
    return null;
  }
  const amount = formatPlanAmount(plan, SubscriptionPolicy.getAmountDueToday(plan));

  return (
    <HStack
      justify="between"
      align="center"
      gap={12}
      testID="subscription-amount-due-today"
      {...props}
    >
      <Text size="b3" weight="semibold" shade={8}>
        {t('paywall.amountDueToday')}
      </Text>
      {/* 요금제를 바꿔 금액이 달라지면 새 금액이 짧게 비치며 들어온다 */}
      <Animated.View key={amount} entering={AMOUNT_ENTERING}>
        <Text size="t2" weight="bold" shade={9} className="tabular-nums">
          {amount}
        </Text>
      </Animated.View>
    </HStack>
  );
}

AmountDueToday.Loading = function Loading(props: Omit<ComponentProps<typeof HStack>, 'children'>) {
  return (
    <HStack justify="between" align="center" gap={12} {...props}>
      <TextSkeleton size="b3" className="w-24" />
      <TextSkeleton size="t2" className="w-28" />
    </HStack>
  );
};
