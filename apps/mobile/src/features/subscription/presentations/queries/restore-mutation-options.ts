import { useSubscriptionService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

export const restoreMutationOptions = () => {
  const subscriptionService = useSubscriptionService();
  const { success, error } = useAppToast();

  return mutationOptions({
    mutationFn: async () => {
      const result = await subscriptionService.restorePurchases();

      return unwrap(result);
    },
    onSuccess: (hasActive) => {
      // 캐시 동기화는 RevenueCatProvider의 CustomerInfo 리스너가 전담
      if (hasActive) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        success('구매가 복원되었어요!');
      } else {
        success('복원할 구매 내역이 없어요');
      }
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      error('구매 복원에 실패했어요');
    },
  });
};
