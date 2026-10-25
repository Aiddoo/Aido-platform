import { useErrorReporter, useSubscriptionService } from '@src/bootstrap/providers/di-context';
import { getCachedMe } from '@src/features/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { notifyError, notifySuccess } from '@src/shared/utils/haptics';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import { match } from 'ts-pattern';

import { PremiumAccessPolicy } from '../domains/premium-access.model';
import { useOpenSubscriptionInquiry } from '../hooks/use-open-subscription-inquiry';
import { toSubscriptionActionFailure } from '../utils/view-models/subscription-failure.view-model';

export const useRestoreMutationOptions = () => {
  const subscriptionService = useSubscriptionService();
  const errorReporter = useErrorReporter();
  const { trackEvent } = useTrack();
  const toast = useAppToast();
  const openInquiry = useOpenSubscriptionInquiry();
  const queryClient = useQueryClient();

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
        toast.success(t('subscription:toast.restoreSuccess'));
      } else {
        toast.success(
          t(
            `subscription:toast.${PremiumAccessPolicy.restoreEmptyMessage(getCachedMe(queryClient)?.premiumAccess)}`,
          ),
        );
      }
    },
    onError: (error) =>
      match(toSubscriptionActionFailure('restore', error))
        .with({ type: 'cancelled' }, { type: 'paymentPending' }, () => undefined)
        // 복원 버튼은 화면에 그대로 남아 다시 누를 수 있으니 토스트에서 문의로만 잇는다
        .with({ type: 'contactSupport' }, (failure) => {
          notifyError();
          errorReporter.captureMessage('subscription_restore_failed', {
            feature: 'subscription',
            severity: 'warning',
            errorCode: failure.diagnosticCode,
          });
          toast.error(t(failure.titleKey), {
            description: t(failure.descriptionKey),
            action: {
              label: t('subscription:failure.contactSupport'),
              onPress: () => openInquiry(failure),
            },
          });
        })
        .exhaustive(),
  });
};
