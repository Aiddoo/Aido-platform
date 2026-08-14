import { useTranslation } from '@src/shared/i18n';
import { HStack, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { formatPrice } from '@src/shared/utils/format';
import { Card, PressableFeedback } from 'heroui-native';
import { View } from 'react-native';

import {
  getAnnualDiscountPercent,
  getMonthlyEquivalent,
  type SubscriptionPlan,
} from '../../models/subscription.model';

interface SubscriptionPlanCardProps {
  plans: SubscriptionPlan[];
  selectedPlanId: string | null;
  onPlanSelect: (planId: string) => void;
  /** 현재 구독 중인 플랜 타입 (구독자일 때만 전달) */
  currentPlanType?: 'monthly' | 'annual' | null;
}

export function SubscriptionPlanCard({
  plans,
  selectedPlanId,
  onPlanSelect,
  currentPlanType,
}: SubscriptionPlanCardProps) {
  const monthlyPlan = plans.find((p) => p.planType === 'monthly');

  const annualPlan = plans.find((p) => p.planType === 'annual');
  const discountPercent =
    monthlyPlan && annualPlan ? getAnnualDiscountPercent(monthlyPlan.price, annualPlan.price) : 0;

  return (
    <VStack gap={12}>
      {plans.map((plan) => (
        <PlanCard
          key={plan.identifier}
          plan={plan}
          isSelected={plan.identifier === selectedPlanId}
          isCurrent={currentPlanType === plan.planType}
          discountPercent={plan.planType === 'annual' ? discountPercent : 0}
          onPress={() => onPlanSelect(plan.identifier)}
        />
      ))}
    </VStack>
  );
}

interface PlanCardProps {
  plan: SubscriptionPlan;
  isSelected: boolean;
  isCurrent: boolean;
  discountPercent: number;
  onPress: () => void;
}

function PlanCard({ plan, isSelected, isCurrent, discountPercent, onPress }: PlanCardProps) {
  const { t } = useTranslation('subscription');
  const isAnnual = plan.planType === 'annual';

  const label = isAnnual ? t('plan.annual') : t('plan.monthly');
  const periodLabel = isAnnual ? t('plan.perYear') : t('plan.perMonth');

  const monthlyEquivalent = isAnnual ? getMonthlyEquivalent(plan.price) : null;

  return (
    <PressableFeedback onPress={onPress} className="rounded-2xl">
      <Card className={cn('border-2 dark:bg-gray-2', isSelected ? 'border-main' : 'border-gray-2')}>
        <PressableFeedback.Highlight className="rounded-2xl" />
        <VStack gap={8}>
          <HStack className="items-center justify-between">
            <HStack gap={8} className="items-center">
              <Text size="b3" weight="bold" className="text-gray-9">
                {label}
              </Text>
              {isCurrent && (
                <View className="bg-gray-2 px-2 py-0.5 rounded-full">
                  <Text size="e2" weight="bold" className="text-gray-6">
                    {t('plan.current')}
                  </Text>
                </View>
              )}
              {isAnnual && discountPercent > 0 && !isCurrent && (
                <View className="bg-main/10 px-2 py-0.5 rounded-full">
                  <Text size="e2" weight="bold" className="text-main">
                    {t('plan.discount', { percent: discountPercent })}
                  </Text>
                </View>
              )}
            </HStack>
            <View
              className={cn(
                'size-5 rounded-full border-2 items-center justify-center',
                isSelected ? 'border-main' : 'border-gray-3',
              )}
            >
              {isSelected && <View className="size-2.5 rounded-full bg-main" />}
            </View>
          </HStack>

          <HStack className="items-baseline" gap={4}>
            <Text size="t2" weight="bold" className="text-gray-9">
              {plan.priceString}
            </Text>
            <Text size="b4" className="text-gray-5">
              {periodLabel}
            </Text>
          </HStack>

          <Text size="e1" className={cn('text-gray-5', monthlyEquivalent === null && 'opacity-0')}>
            {monthlyEquivalent !== null
              ? t('plan.monthlyEquivalent', {
                  price: formatPrice(monthlyEquivalent, plan.currencyCode),
                })
              : '\u00A0'}
          </Text>
        </VStack>
      </Card>
    </PressableFeedback>
  );
}
