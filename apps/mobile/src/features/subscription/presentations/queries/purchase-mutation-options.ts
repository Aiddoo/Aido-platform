import { useSubscriptionService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { isPaymentPendingError, isPurchaseCancelledError } from '../../models/subscription.error';

export const purchaseMutationOptions = () => {
  const subscriptionService = useSubscriptionService();
  const { success, error } = useAppToast();

  return mutationOptions({
    mutationFn: async (identifier: string) => {
      const result = await subscriptionService.purchase(identifier);
      return unwrap(result);
    },
    onSuccess: () => {
      // 캐시 동기화는 RevenueCatProvider의 CustomerInfo 리스너가 전담
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      success('구독이 완료되었어요!');
    },
    onError: (err) => {
      if (isPurchaseCancelledError(err)) {
        success('구독이 취소되었어요');
        return;
      }

      if (isPaymentPendingError(err)) {
        success('결제 승인 대기 중이에요. 승인 후 자동으로 반영돼요.');
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      error('구독에 실패했어요');
    },
  });
};
