import {
  useErrorReporter,
  useHaptics,
  useSubscriptionService,
} from '@src/bootstrap/providers/di-context';
import { getCachedMe } from '@src/features/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { SENTRY_MESSAGES } from '@src/shared/observability/telemetry-keys';
import { useConfirmDialog } from '@src/shared/ui';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import { match } from 'ts-pattern';

import { PremiumAccessPolicy } from '../domains/premium-access.model';
import { SubscriptionFailurePolicy } from '../domains/subscription-failure.model';
import { useOpenSubscriptionInquiry } from '../hooks/use-open-subscription-inquiry';
import { toPurchaseFailedReason } from '../utils/analytics/purchase-failed-reason';
import { toSubscriptionActionFailure } from '../utils/view-models/subscription-failure.view-model';
import { syncMeUntilStorePremium } from './subscription-cache';

export const usePurchaseMutationOptions = () => {
  const haptics = useHaptics();
  const subscriptionService = useSubscriptionService();
  const errorReporter = useErrorReporter();
  const { trackEvent } = useTrack();
  const toast = useAppToast();
  const confirmDialog = useConfirmDialog();
  const openInquiry = useOpenSubscriptionInquiry();
  const queryClient = useQueryClient();

  return mutationOptions({
    // 오프라인 동안 멈췄다가 연결되자마자 결제 창이 뜨지 않게 스토어 SDK에 바로 맡긴다(화면은 오프라인이면 버튼을 잠근다)
    networkMode: 'always',
    // 결제 전 출처를 기억해 둔다. 반영된 뒤에는 STORE라 보상 기간 중 결제였는지 알 수 없다
    onMutate: () => ({ previousAccess: getCachedMe(queryClient)?.premiumAccess }),
    // 서버가 결제를 반영할 때까지 기다리는 동안에도 결제 중으로 두어 버튼을 잠근다
    mutationFn: async (identifier: string) => {
      const hasStoreEntitlement = unwrap(await subscriptionService.purchase(identifier));
      return hasStoreEntitlement && (await syncMeUntilStorePremium(queryClient));
    },
    onSuccess: (isReflected, identifier, context) => {
      trackEvent('subscription_started', { product_id: identifier });
      haptics.notify('success');
      if (!isReflected) {
        toast.toast(t('subscription:toast.purchaseSyncPending'));
        return;
      }
      toast.success(
        t(
          `subscription:toast.${PremiumAccessPolicy.purchaseSuccessMessage(context.previousAccess)}`,
        ),
      );
    },
    onError: (error) =>
      match(toSubscriptionActionFailure('purchase', error))
        // 사용자가 직접 취소했으면 이미 알고 있다
        .with({ type: 'cancelled' }, () => undefined)
        .with({ type: 'paymentPending' }, () =>
          toast.success(t('subscription:toast.paymentPending')),
        )
        // 돈이 빠져나갔을 수도 있어 지나가는 토스트 대신 다이얼로그로 문의할 길을 남긴다
        .with({ type: 'contactSupport' }, async (failure) => {
          haptics.notify('error');
          const reason = toPurchaseFailedReason(SubscriptionFailurePolicy.getFailureCause(error));
          if (reason != null) {
            trackEvent('purchase_failed', { reason });
          }
          errorReporter.captureMessage(SENTRY_MESSAGES.SUBSCRIPTION_PURCHASE_FAILED, {
            feature: 'subscription',
            severity: 'warning',
            errorCode: failure.diagnosticCode,
          });
          const shouldContactSupport = await confirmDialog.open({
            title: t(failure.titleKey),
            description: t(failure.descriptionKey),
            cancelLabel: t('common:actions.close'),
            confirmLabel: t('subscription:failure.contactSupport'),
          });
          if (shouldContactSupport) {
            openInquiry(failure);
          }
        })
        .exhaustive(),
  });
};
