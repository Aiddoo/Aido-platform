import { useSubscriptionService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { t } from '@src/shared/i18n';
import { mutationOptions } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { isPaymentPendingError, isPurchaseCancelledError } from '../../models/subscription.error';

export const usePurchaseMutationOptions = () => {
  const subscriptionService = useSubscriptionService();
  const { trackEvent } = useTrack();
  const { success, error } = useAppToast();

  return mutationOptions({
    mutationFn: async (identifier: string) => {
      const result = await subscriptionService.purchase(identifier);
      return unwrap(result);
    },
    onSuccess: (_data, identifier) => {
      trackEvent('subscription_started', { product_id: identifier });
      // 캐시 동기화는 RevenueCatProvider의 CustomerInfo 리스너가 전담
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      success(t('subscription:toast.purchaseSuccess'));
    },
    onError: (err) => {
      // 사용자가 직접 취소한 경우 — 이미 인지하고 있으므로 조용히 무시
      if (isPurchaseCancelledError(err)) return;

      if (isPaymentPendingError(err)) {
        success(t('subscription:toast.paymentPending'));
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      error(t('subscription:toast.purchaseFailed'));
    },
  });
};
