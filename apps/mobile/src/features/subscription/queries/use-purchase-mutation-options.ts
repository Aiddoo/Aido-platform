import { useSubscriptionService } from '@src/bootstrap/providers/di-context';
import { getCachedMe } from '@src/features/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { notifyError, notifySuccess } from '@src/shared/utils/haptics';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { PremiumAccessPolicy } from '../domains/premium-access.model';
import { isPaymentPendingError, isPurchaseCancelledError } from '../domains/subscription.error';

export const usePurchaseMutationOptions = () => {
  const subscriptionService = useSubscriptionService();
  const { trackEvent } = useTrack();
  const { success, error } = useAppToast();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: async (identifier: string) => {
      const result = await subscriptionService.purchase(identifier);
      return unwrap(result);
    },
    onSuccess: (_data, identifier) => {
      trackEvent('subscription_started', { product_id: identifier });
      // 캐시 동기화는 RevenueCatProvider의 CustomerInfo 리스너가 전담
      notifySuccess();
      success(
        t(
          `subscription:toast.${PremiumAccessPolicy.purchaseSuccessMessage(getCachedMe(queryClient)?.premiumAccess)}`,
        ),
      );
    },
    onError: (err) => {
      // 사용자가 직접 취소한 경우 — 이미 인지하고 있으므로 조용히 무시
      if (isPurchaseCancelledError(err)) {
        return;
      }

      if (isPaymentPendingError(err)) {
        success(t('subscription:toast.paymentPending'));
        return;
      }

      notifyError();
      error(t('subscription:toast.purchaseFailed'));
    },
  });
};
