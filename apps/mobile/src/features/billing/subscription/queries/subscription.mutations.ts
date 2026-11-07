import {
  useErrorReporter,
  useHaptics,
  useSubscriptionService,
} from '@src/bootstrap/providers/di-context';
import { SENTRY_MESSAGES } from '@src/core/observability/telemetry-keys';
import { PremiumAccessPolicy } from '@src/features/identity/user/domains/premium-access.model';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { useConfirmDialog } from '@src/shared/ui';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import { match } from 'ts-pattern';

import { SubscriptionFailurePolicy } from '../domains/subscription-failure.model';
import { useOpenSubscriptionInquiry } from '../hooks/use-open-subscription-inquiry';
import { toPurchaseFailedReason } from '../utils/purchase-failed-reason';
import { toSubscriptionActionFailure } from '../utils/subscription-failure.view-model';
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
      // 보상 기간 중에 구독하면 남은 보상이 구독 뒤로 미뤄진다는 것을 함께 알린다
      toast.success(
        context.previousAccess != null && PremiumAccessPolicy.isGrantOnly(context.previousAccess)
          ? t('subscription:toast.purchaseSuccessWithReward')
          : t('subscription:toast.purchaseSuccess'),
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
        // 복원할 구매가 없어도 보상 기간은 그대로라는 것을 알린다
        const premiumAccess = getCachedMe(queryClient)?.premiumAccess;
        toast.success(
          premiumAccess != null && PremiumAccessPolicy.isGrantOnly(premiumAccess)
            ? t('subscription:toast.restoreEmptyWithReward')
            : t('subscription:toast.restoreEmpty'),
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
