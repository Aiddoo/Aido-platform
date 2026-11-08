import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { useTranslation } from '@src/shared/i18n';
import { Box, Button } from '@src/shared/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { match } from 'ts-pattern';

import { type SubscriptionPlan } from '../domains/subscription.model';
import { SubscriptionPolicy } from '../domains/subscription.model';
import { useSubscriptionParams } from '../hooks/use-subscription-params';
import { usePurchaseMutationOptions } from '../queries/subscription.mutations';
import { useGetOfferingsQueryOptions } from '../queries/subscription.queries';
import { SubscriptionOfflineActionsNotice } from './subscription-offline-actions-notice';

interface PurchaseButtonProps {
  planId: string | undefined;
}

export function PurchaseButton({ planId }: PurchaseButtonProps) {
  const { t } = useTranslation('subscription');
  const purchase = useMutation(usePurchaseMutationOptions());
  const [{ view }] = useSubscriptionParams();
  const isOnline = useIsOnline();
  // 요금제 자리의 경계 밖이라 실패를 던지지 않는다. 요금제를 받기 전에는 버튼만 잠긴다
  const { data: availability } = useQuery({
    ...useGetOfferingsQueryOptions(),
    throwOnError: false,
  });
  const selectedPlan =
    availability?.status === 'available'
      ? SubscriptionPolicy.findSelectedPlan(availability.offering, planId)
      : null;

  const handlePurchase = () => {
    if (!selectedPlan || purchase.isPending) {
      return;
    }
    purchase.mutate(selectedPlan, {
      // 보상 영수증에서 요금제로 들어왔으면 영수증으로 돌아가 결제한 영수증으로 바뀌는 것을 보여 준다
      onSuccess: () => {
        if (view === 'plans' && router.canGoBack()) {
          router.back();
        }
      },
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
        {t(getPurchaseLabelKey(selectedPlan))}
      </Button>
    </>
  );
}

/** 고른 요금제가 버튼 글자가 된다. 요금제를 받기 전에는 잠긴 버튼에 일반 문구를 둔다 */
function getPurchaseLabelKey(plan: SubscriptionPlan | null) {
  if (plan == null) {
    return 'paywall.subscribeButton' as const;
  }
  return match(plan.planType)
    .with('annual', () => 'paywall.startAnnual' as const)
    .with('monthly', () => 'paywall.startMonthly' as const)
    .exhaustive();
}
