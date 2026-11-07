import { useTranslation } from '@src/shared/i18n';
import { HStack, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { formatPrice } from '@src/shared/utils/format';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Card, Chip, Radio, RadioGroup } from 'heroui-native';
import type { ComponentProps } from 'react';

import { SubscriptionPolicy } from '../domains/subscription.model';
import { useGetOfferingsQueryOptions } from '../queries/subscription.queries';
import { type SubscriptionPlan } from '../schemas/subscription.schema';

type SubscriptionPlanInputProps = Omit<ComponentProps<typeof RadioGroup>, 'children'>;

export function SubscriptionPlanInput(props: SubscriptionPlanInputProps) {
  const { data: availability } = useSuspenseQuery(useGetOfferingsQueryOptions());
  const plans = availability.status === 'available' ? availability.offering.plans : [];
  const monthlyPlan = plans.find((plan) => plan.planType === 'monthly');
  const annualPlan = plans.find((plan) => plan.planType === 'annual');
  const annualDiscountPercent =
    monthlyPlan && annualPlan
      ? SubscriptionPolicy.getAnnualDiscountPercent(monthlyPlan, annualPlan)
      : 0;

  return (
    <RadioGroup className="gap-3" {...props}>
      {monthlyPlan && <PlanOption plan={monthlyPlan} discountPercent={0} />}
      {annualPlan && <PlanOption plan={annualPlan} discountPercent={annualDiscountPercent} />}
    </RadioGroup>
  );
}

interface PlanOptionProps {
  plan: SubscriptionPlan;
  discountPercent: number;
}

function PlanOption({ plan, discountPercent }: PlanOptionProps) {
  const { t } = useTranslation('subscription');
  const isAnnual = plan.planType === 'annual';

  const label = isAnnual ? t('plan.annual') : t('plan.monthly');
  const periodLabel = isAnnual ? t('plan.perYear') : t('plan.perMonth');

  const monthlyEquivalent = isAnnual ? SubscriptionPolicy.getMonthlyEquivalent(plan) : null;

  return (
    <RadioGroup.Item value={plan.identifier} className="rounded-2xl">
      {({ isSelected }) => (
        <Card
          className={cn(
            'flex-1 border-2 bg-white dark:bg-gray-2',
            isSelected ? 'border-main' : 'border-gray-2',
          )}
        >
          <VStack gap={8}>
            <HStack className="items-center justify-between">
              <HStack gap={8} className="items-center">
                <Text size="b3" weight="bold" className="text-gray-9">
                  {label}
                </Text>
                {isAnnual && discountPercent > 0 && (
                  <Chip variant="soft" className="self-center rounded-full bg-main/10 px-2 py-0.5">
                    <Text size="e2" weight="bold" className="text-main">
                      {t('plan.discount', { percent: discountPercent })}
                    </Text>
                  </Chip>
                )}
              </HStack>
              <Radio>
                <Radio.Indicator />
              </Radio>
            </HStack>

            <HStack className="items-baseline" gap={4}>
              <Text size="t2" weight="bold" className="text-gray-9">
                {plan.priceString}
              </Text>
              <Text size="b4" className="text-gray-5">
                {periodLabel}
              </Text>
            </HStack>

            <Text size="e1" className={cn('text-gray-5', monthlyEquivalent == null && 'opacity-0')}>
              {monthlyEquivalent != null
                ? t('plan.monthlyEquivalent', {
                    price: formatPrice(monthlyEquivalent, plan.currencyCode),
                  })
                : '\u00A0'}
            </Text>
          </VStack>
        </Card>
      )}
    </RadioGroup.Item>
  );
}
