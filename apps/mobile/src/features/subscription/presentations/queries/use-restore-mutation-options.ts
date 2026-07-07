import { useSubscriptionService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { t } from '@src/shared/i18n';
import { mutationOptions } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

export const useRestoreMutationOptions = () => {
  const subscriptionService = useSubscriptionService();
  const { trackEvent } = useTrack();
  const { success, error } = useAppToast();

  return mutationOptions({
    mutationFn: async () => {
      const result = await subscriptionService.restorePurchases();

      return unwrap(result);
    },
    onSuccess: (hasActive) => {
      // 캐시 동기화는 RevenueCatProvider의 CustomerInfo 리스너가 전담
      if (hasActive) {
        trackEvent('subscription_restored');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        success(t('subscription:toast.restoreSuccess'));
      } else {
        success(t('subscription:toast.restoreEmpty'));
      }
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      error(t('subscription:toast.restoreFailed'));
    },
  });
};
