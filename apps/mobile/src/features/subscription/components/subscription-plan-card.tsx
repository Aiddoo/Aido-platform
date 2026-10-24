import { useTranslation } from '@src/shared/i18n';
import { HStack, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { formatPrice } from '@src/shared/utils/format';
import { Card, Radio, RadioGroup } from 'heroui-native';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import {
  getAnnualDiscountPercent,
  getMonthlyEquivalent,
  type SubscriptionPlan,
} from '../domains/subscription.model';

interface SubscriptionPlanCardProps extends Omit<ComponentProps<typeof RadioGroup>, 'children'> {
  plans: SubscriptionPlan[];
}

export function SubscriptionPlanCard({ plans, ...props }: SubscriptionPlanCardProps) {
  const monthlyPlan = plans.find((p) => p.planType === 'monthly');
  const annualPlan = plans.find((p) => p.planType === 'annual');
  const discountPercent =
    monthlyPlan && annualPlan ? getAnnualDiscountPercent(monthlyPlan.price, annualPlan.price) : 0;

  return (
    <RadioGroup className="gap-3" {...props}>
      {plans.map((plan) => (
        <PlanCard
          key={plan.identifier}
          plan={plan}
          discountPercent={plan.planType === 'annual' ? discountPercent : 0}
        />
      ))}
    </RadioGroup>
  );
}

interface PlanCardProps {
  plan: SubscriptionPlan;
  discountPercent: number;
}

function PlanCard({ plan, discountPercent }: PlanCardProps) {
  const { t } = useTranslation('subscription');
  const isAnnual = plan.planType === 'annual';

  const label = isAnnual ? t('plan.annual') : t('plan.monthly');
  const periodLabel = isAnnual ? t('plan.perYear') : t('plan.perMonth');

  const monthlyEquivalent = isAnnual ? getMonthlyEquivalent(plan.price) : null;

  return (
    <RadioGroup.Item value={plan.identifier} className="rounded-2xl">
      {({ isSelected }) => (
        <Card
          className={cn(
            'flex-1 border-2 dark:bg-gray-2',
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
                  <View className="bg-main/10 px-2 py-0.5 rounded-full">
                    <Text size="e2" weight="bold" className="text-main">
                      {t('plan.discount', { percent: discountPercent })}
                    </Text>
                  </View>
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

            <Text
              size="e1"
              className={cn('text-gray-5', monthlyEquivalent === null && 'opacity-0')}
            >
              {monthlyEquivalent !== null
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
