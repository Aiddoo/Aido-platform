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
import { type SubscriptionPlan } from '../domains/subscription.model';
import { hasFreeTrial } from '../domains/subscription.model';
import { useOpenSubscriptionInquiry } from '../hooks/use-open-subscription-inquiry';
import { toPurchaseFailedReason } from '../utils/subscription-analytics';
import { toSubscriptionActionFailure } from '../utils/subscription-failure.view-model';
import { syncMeUntilStorePremium } from './subscription-cache';

type PurchaseVariables = Pick<SubscriptionPlan, 'identifier' | 'planType' | 'freeTrial'>;

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
    // 오프라인 동안 멈췄다가 연결되자마자 결제 창이 뜨지 않게 스토어 SDK에 바로 맡긴다(화면은 오프라인이면 버튼을 잠근다)
    networkMode: 'always',
    // 서버가 결제를 반영할 때까지 기다리는 동안에도 결제 중으로 두어 버튼을 잠근다
    mutationFn: async ({ identifier }: PurchaseVariables) => {
      // 반영된 뒤에는 출처가 STORE라 보상 기간 중 결제였는지 결제 전에 읽어 둔다
      const previousAccess = getCachedMe(queryClient)?.premiumAccess;
      const hadRewardOnly =
        previousAccess != null && PremiumAccessPolicy.isGrantOnly(previousAccess);
      const hasStoreEntitlement = unwrap(await subscriptionService.purchase(identifier));
      const isReflected = hasStoreEntitlement && (await syncMeUntilStorePremium(queryClient));

      return { isReflected, hadRewardOnly };
    },
    // 성공은 결제 뒤 시작 화면이 알린다. 서버 반영이 늦을 때만 기다려 달라고 따로 알린다
    onSuccess: ({ isReflected }, plan) => {
      trackEvent('subscription_started', {
        product_id: plan.identifier,
        plan_type: plan.planType,
        is_trial: hasFreeTrial(plan.freeTrial),
      });
      haptics.notify('success');
      if (!isReflected) {
        toast.toast(t('subscription:toast.purchaseSyncPending'));
      }
    },
    onError: (error, plan) =>
      match(toSubscriptionActionFailure('purchase', error))
        // 사용자가 직접 취소했으면 이미 알고 있어 알리지 않고 퍼널에만 남긴다
        .with({ type: 'cancelled' }, () => {
          trackEvent('purchase_cancelled', {
            plan_type: plan.planType,
            is_trial: hasFreeTrial(plan.freeTrial),
          });
        })
        .with({ type: 'paymentPending' }, () =>
          toast.success(t('subscription:toast.paymentPending')),
        )
        // 돈이 빠져나갔을 수도 있어 지나가는 토스트 대신 다이얼로그로 문의할 길을 남긴다
        .with({ type: 'contactSupport' }, (failure) => {
          haptics.notify('error');
          const reason = toPurchaseFailedReason(SubscriptionFailurePolicy.getFailureCause(error));
          if (reason != null) {
            trackEvent('purchase_failed', {
              reason,
              plan_type: plan.planType,
              is_trial: hasFreeTrial(plan.freeTrial),
            });
          }
          errorReporter.captureMessage(ERROR_REPORT_MESSAGES.SUBSCRIPTION_PURCHASE_FAILED, {
            feature: 'subscription',
            severity: 'warning',
            errorCode: failure.diagnosticCode,
          });
          // 다이얼로그가 닫힐 때까지 구매 버튼이 돌지 않게 기다리지 않는다
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
