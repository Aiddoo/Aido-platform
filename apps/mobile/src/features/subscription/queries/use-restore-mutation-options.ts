import { useSubscriptionService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { notifyError, notifySuccess } from '@src/shared/utils/haptics';
import { mutationOptions } from '@tanstack/react-query';

export const useRestoreMutationOptions = () => {
  const subscriptionService = useSubscriptionService();
  const { trackEvent } = useTrack();
  const { success, error } = useAppToast();

  return mutationOptions({
    mutationFn: async () => {
      const result = await subscriptionService.restorePurchases();

      return unwrap(result);
    },
    onSuccess: (hasRestoredStorePurchase) => {
      // 캐시 동기화는 RevenueCatProvider의 CustomerInfo 리스너가 전담
      if (hasRestoredStorePurchase) {
        trackEvent('subscription_restored');
        notifySuccess();
        success(t('subscription:toast.restoreSuccess'));
      } else {
        success(t('subscription:toast.restoreEmpty'));
      }
    },
    onError: () => {
      notifyError();
      error(t('subscription:toast.restoreFailed'));
    },
  });
};
