import { formatYearAwareDateKeyLabel } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { useTranslation } from '@src/shared/i18n';
import { useLocalDate } from '@src/shared/providers/local-date-provider';
import { Box, Button, Text, TextSkeleton } from '@src/shared/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { match } from 'ts-pattern';

import { type SubscriptionPlan } from '../domains/subscription.model';
import { hasFreeTrial, SubscriptionPolicy } from '../domains/subscription.model';
import { useSelectedPlanId } from '../hooks/use-subscription-params';
import { usePurchaseMutationOptions } from '../queries/subscription.mutations';
import { useGetOfferingsQueryOptions } from '../queries/subscription.queries';
import {
  getFreeTrialPeriodLabelKey,
  getPlanPriceLabelKey,
} from '../utils/subscription-label.view-model';
import { SubscriptionOfflineActionsNotice } from './subscription-offline-actions-notice';

interface PurchaseButtonProps {
  /** 스토어 결제가 끝났다. 서버 반영을 기다리지 않고 방금 산 요금제로 다음 화면을 그린다 */
  onPurchased: (purchase: { plan: SubscriptionPlan; hadRewardOnly: boolean }) => void;
}

export function PurchaseButton({ onPurchased }: PurchaseButtonProps) {
  const { t } = useTranslation('subscription');
  const [planId] = useSelectedPlanId();
  const purchase = useMutation(usePurchaseMutationOptions());
  const isOnline = useIsOnline();
  const { currentLocalDateKey } = useLocalDate();
  // 요금제 자리의 경계 밖이라 실패를 던지지 않는다. 요금제를 받기 전에는 버튼만 잠긴다
  const { data: availability, isLoading: isPlanLoading } = useQuery({
    ...useGetOfferingsQueryOptions(),
    throwOnError: false,
  });
  const selectedPlan =
    availability?.status === 'available'
      ? SubscriptionPolicy.findSelectedPlan(availability.offering, planId)
      : null;
  const freeTrial = selectedPlan?.freeTrial ?? null;
  const trialEndDateKey =
    selectedPlan == null
      ? null
      : SubscriptionPolicy.getFreeTrialEndDateKey(selectedPlan, currentLocalDateKey);

  const handlePurchase = () => {
    if (!selectedPlan || purchase.isPending) {
      return;
    }
    purchase.mutate(selectedPlan, {
      onSuccess: ({ hadRewardOnly }) => onPurchased({ plan: selectedPlan, hadRewardOnly }),
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
        {t(getPurchaseLabelKey(selectedPlan), {
          period:
            freeTrial == null
              ? undefined
              : t(getFreeTrialPeriodLabelKey(freeTrial.periodUnit), {
                  count: freeTrial.periodNumberOfUnits,
                }),
        })}
      </Button>
      {/* "무료"만 크게 보이지 않게 버튼 바로 아래에 금액·주기·해지를 함께 둔다(App Store 3.1.2) */}
      <PurchaseDisclosure
        plan={selectedPlan}
        trialEndDateKey={trialEndDateKey}
        isPlanLoading={isPlanLoading}
      />
    </>
  );
}

const DISCLOSURE_TEXT_SIZE = 'e1';

interface PurchaseDisclosureProps {
  plan: SubscriptionPlan | null;
  trialEndDateKey: string | null;
  isPlanLoading: boolean;
}

/** 체험이 있든 없든 같은 한 줄로 그리고, 요금제를 받는 동안에도 그 줄을 잡아 둬 하단 바 높이가 바뀌지 않는다 */
function PurchaseDisclosure({ plan, trialEndDateKey, isPlanLoading }: PurchaseDisclosureProps) {
  const { t } = useTranslation('subscription');
  const dateFormatContext = useDateFormatContext();
  const { currentLocalDateKey } = useLocalDate();

  if (plan == null) {
    // 오프라인으로 멈춘 조회는 로딩이 아니라 자리를 잡지 않는다. 버튼 위 오프라인 안내가 대신 알린다
    return isPlanLoading ? (
      <TextSkeleton size={DISCLOSURE_TEXT_SIZE} className="mt-2 w-56 self-center" />
    ) : null;
  }

  const price = t(getPlanPriceLabelKey(plan.planType), { price: plan.priceString });

  return (
    <Text
      size={DISCLOSURE_TEXT_SIZE}
      shade={6}
      align="center"
      lineBreakStrategyIOS="hangul-word"
      className="pt-2"
      testID={
        trialEndDateKey == null
          ? 'subscription-renewal-disclosure'
          : 'subscription-trial-disclosure'
      }
    >
      {trialEndDateKey == null
        ? t('paywall.renewalDisclosure', { price })
        : t('paywall.trialDisclosure', {
            date: formatYearAwareDateKeyLabel(
              trialEndDateKey,
              currentLocalDateKey,
              dateFormatContext,
            ),
            price,
          })}
    </Text>
  );
}

/** 고른 요금제가 버튼 글자가 된다. 요금제를 받기 전에는 잠긴 버튼에 일반 문구를 둔다 */
function getPurchaseLabelKey(plan: SubscriptionPlan | null) {
  if (plan == null) {
    return 'paywall.subscribeButton' as const;
  }
  if (hasFreeTrial(plan.freeTrial)) {
    return 'paywall.startFreeTrial' as const;
  }
  return match(plan.planType)
    .with('annual', () => 'paywall.startAnnual' as const)
    .with('monthly', () => 'paywall.startMonthly' as const)
    .exhaustive();
}
