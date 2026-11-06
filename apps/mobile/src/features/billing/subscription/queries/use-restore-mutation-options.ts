import {
  useErrorReporter,
  useHaptics,
  useSubscriptionService,
} from '@src/bootstrap/providers/di-context';
import { PremiumAccessPolicy } from '@src/features/identity/user/domains/premium-access.model';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { SENTRY_MESSAGES } from '@src/shared/observability/telemetry-keys';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import { match } from 'ts-pattern';

import { useOpenSubscriptionInquiry } from '../hooks/use-open-subscription-inquiry';
import { toSubscriptionActionFailure } from '../utils/view-models/subscription-failure.view-model';
import { syncMeUntilStorePremium } from './subscription-cache';

export const useRestoreMutationOptions = () => {
  const haptics = useHaptics();
  const subscriptionService = useSubscriptionService();
  const errorReporter = useErrorReporter();
  const { trackEvent } = useTrack();
  const toast = useAppToast();
  const openInquiry = useOpenSubscriptionInquiry();
  const queryClient = useQueryClient();

  return mutationOptions({
    // 오프라인 동안 멈췄다가 연결되자마자 결제 창이 뜨지 않게 스토어 SDK에 바로 맡긴다(화면은 오프라인이면 버튼을 잠근다)
    networkMode: 'always',
    // 복원한 구독은 서버가 스토어 웹훅(TRANSFER)을 반영할 때까지 기다려 복원 중으로 둔다(결제와 같은 대기)
    mutationFn: async () => {
      const hasRestoredStorePurchase = unwrap(await subscriptionService.restorePurchases());
      const isReflected = hasRestoredStorePurchase && (await syncMeUntilStorePremium(queryClient));

      return { hasRestoredStorePurchase, isReflected };
    },
    onSuccess: ({ hasRestoredStorePurchase, isReflected }) => {
      if (hasRestoredStorePurchase) {
        trackEvent('subscription_restored');
        haptics.notify('success');
        if (!isReflected) {
          toast.toast(t('subscription:toast.purchaseSyncPending'));
          return;
        }
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
          haptics.notify('error');
          errorReporter.captureMessage(SENTRY_MESSAGES.SUBSCRIPTION_RESTORE_FAILED, {
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
