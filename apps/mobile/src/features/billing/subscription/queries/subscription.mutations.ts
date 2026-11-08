import {
  useErrorReporter,
  useHaptics,
  useSubscriptionService,
} from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { ERROR_REPORT_MESSAGES } from '@src/core/observability/telemetry-keys';
import { PremiumAccessPolicy } from '@src/features/identity/user/domains/premium-access.model';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { t } from '@src/shared/i18n';
import { useConfirmDialog } from '@src/shared/ui';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { match } from 'ts-pattern';

import { SubscriptionFailurePolicy } from '../domains/subscription-failure.model';
import { useOpenSubscriptionInquiry } from '../hooks/use-open-subscription-inquiry';
import { toPurchaseFailedReason } from '../utils/subscription-analytics';
import { toSubscriptionActionFailure } from '../utils/subscription-failure.view-model';
import { syncMeUntilStorePremium } from './subscription-cache';

export function usePurchaseMutationOptions() {
  const haptics = useHaptics();
  const subscriptionService = useSubscriptionService();
  const errorReporter = useErrorReporter();
  const { trackEvent } = useTrack();
  const toast = useAppToast();
  const confirmDialog = useConfirmDialog();
  const openInquiry = useOpenSubscriptionInquiry();
  const queryClient = useQueryClient();

  return mutationOptions({
    // 오프라인에 멈췄다가 연결되자마자 결제 창이 뜨지 않게 스토어 SDK에 바로 맡긴다
    networkMode: 'always',
    // 반영된 뒤에는 STORE라 보상 기간 중 결제였는지 알 수 없어 미리 기억한다
    onMutate: () => ({ previousAccess: getCachedMe(queryClient)?.premiumAccess }),
    mutationFn: async (identifier: string) => {
      const hasStoreEntitlement = unwrap(await subscriptionService.purchase(identifier));
      const isReflected = hasStoreEntitlement && (await syncMeUntilStorePremium(queryClient));

      return { isReflected };
    },
    onSuccess: ({ isReflected }, identifier, context) => {
      trackEvent('subscription_started', { product_id: identifier });
      haptics.notify('success');
      if (!isReflected) {
        toast.toast(t('subscription:toast.purchaseSyncPending'));
        return;
      }
      toast.success(
        context.previousAccess != null && PremiumAccessPolicy.isGrantOnly(context.previousAccess)
          ? t('subscription:toast.purchaseSuccessWithReward')
          : t('subscription:toast.purchaseSuccess'),
      );
    },
    onError: (error) =>
      match(toSubscriptionActionFailure('purchase', error))
        .with({ type: 'cancelled' }, () => undefined)
        .with({ type: 'paymentPending' }, () =>
          toast.success(t('subscription:toast.paymentPending')),
        )
        // 돈이 빠져나갔을 수 있어 토스트 대신 다이얼로그로 문의할 길을 남긴다
        .with({ type: 'contactSupport' }, (failure) => {
          haptics.notify('error');
          const reason = toPurchaseFailedReason(SubscriptionFailurePolicy.getFailureCause(error));
          if (reason != null) {
            trackEvent('purchase_failed', { reason });
          }
          errorReporter.captureMessage(ERROR_REPORT_MESSAGES.SUBSCRIPTION_PURCHASE_FAILED, {
            feature: 'subscription',
            severity: 'warning',
            errorCode: failure.diagnosticCode,
          });
          confirmDialog
            .openAsync({
              title: t(failure.titleKey),
              description: t(failure.descriptionKey),
              cancelLabel: t('common:actions.close'),
              confirmLabel: t('subscription:failure.contactSupport'),
            })
            .then((shouldContactSupport) => {
              if (shouldContactSupport) {
                openInquiry(failure);
              }
            })
            .catch(noop);
        })
        .exhaustive(),
  });
}

export function useRestoreMutationOptions() {
  const haptics = useHaptics();
  const subscriptionService = useSubscriptionService();
  const errorReporter = useErrorReporter();
  const { trackEvent } = useTrack();
  const toast = useAppToast();
  const openInquiry = useOpenSubscriptionInquiry();
  const queryClient = useQueryClient();

  return mutationOptions({
    // 오프라인에 멈췄다가 연결되자마자 결제 창이 뜨지 않게 스토어 SDK에 바로 맡긴다
    networkMode: 'always',
    // 복원한 구독은 서버가 스토어 웹훅(TRANSFER)을 반영할 때까지 기다린다
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
        .with({ type: 'contactSupport' }, (failure) => {
          haptics.notify('error');
          errorReporter.captureMessage(ERROR_REPORT_MESSAGES.SUBSCRIPTION_RESTORE_FAILED, {
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
}
