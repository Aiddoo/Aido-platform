import { useTranslation } from '@src/shared/i18n';
import { HStack, Text } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import type { ComponentProps } from 'react';

import { SubscriptionPolicy } from '../domains/subscription.model';
import { useSelectedPlanId } from '../hooks/use-subscription-params';
import { useGetOfferingsQueryOptions } from '../queries/subscription.queries';
import { formatPlanAmount } from '../utils/plan-price.view-model';

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
      <Text size="t2" weight="bold" shade={9} className="tabular-nums">
        {formatPlanAmount(plan, SubscriptionPolicy.getAmountDueToday(plan))}
      </Text>
    </HStack>
  );
}
