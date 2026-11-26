import {
  useErrorReporter,
  useHaptics,
  useSubscriptionService,
} from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { ERROR_REPORT_MESSAGES } from '@src/core/observability/telemetry-keys';
import { PremiumAccessPolicy } from '@src/features/identity/user/domains/premium-access.model';
import { getCachedMe, refetchMe } from '@src/features/identity/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui';
import { mutationOptions, type QueryClient, useQueryClient } from '@tanstack/react-query';
import { delay, noop } from 'es-toolkit';
import { match } from 'ts-pattern';

import {
  getSubscriptionDiagnosticCode,
  getSubscriptionFailure,
} from '../domains/subscription.error';
import { type SubscriptionPlan, SubscriptionPolicy } from '../domains/subscription.model';
import { toPurchaseFailedReason } from '../utils/subscription-analytics';
import { SUBSCRIPTION_MUTATION_KEYS } from './subscription-mutation-keys';

/** 결제 뒤 서버가 스토어 웹훅을 반영할 때까지 내 정보를 다시 받는 간격. 모두 합쳐 10초 남짓에서 멈춘다 */
const STORE_PREMIUM_SYNC_DELAYS_MS = [500, 1_000, 1_500, 2_500, 4_000] as const;

interface SyncStorePremiumOptions {
  delaysMs: readonly number[];
  wait: (ms: number) => Promise<void>;
}

function isStorePremiumReflected(queryClient: QueryClient) {
  const premiumAccess = getCachedMe(queryClient)?.premiumAccess;
  return premiumAccess != null && PremiumAccessPolicy.isStoreSubscribed(premiumAccess);
}

/** 캐시에 낙관적으로 쓰지 않고 서버 값이 STORE가 될 때까지만 기다린다. 끝내 반영되지 않거나 기다리는 동안 사용자가 바뀌면 false다 */
export async function syncMeUntilStorePremium(
  queryClient: QueryClient,
  { delaysMs, wait }: SyncStorePremiumOptions,
) {
  const userId = getCachedMe(queryClient)?.id;
  // 내 정보가 없으면 로그아웃 뒤다. 10초 동안 내 정보를 다시 받으며 401을 내지 않는다
  if (userId == null) {
    return false;
  }
  // 백오프 재조회다. 앞 응답으로 멈출지 정해 한 번에 보내지 않는다
  for (const ms of delaysMs) {
    if (isStorePremiumReflected(queryClient)) {
      return true;
    }
    await wait(ms);
    // 기다리는 동안 로그아웃·계정 전환으로 사용자가 바뀌었으면 다른 사용자의 내 정보를 건드리지 않고 멈춘다
    if (getCachedMe(queryClient)?.id !== userId) {
      return false;
    }
    await refetchMe(queryClient);
  }
  return isStorePremiumReflected(queryClient);
}

function waitForStorePremium(queryClient: QueryClient) {
  return syncMeUntilStorePremium(queryClient, {
    delaysMs: STORE_PREMIUM_SYNC_DELAYS_MS,
    wait: delay,
  });
}

export function usePurchaseMutationOptions() {
  const haptics = useHaptics();
  const subscriptionService = useSubscriptionService();
  const errorReporter = useErrorReporter();
  const { trackEvent } = useTrack();
  const toast = useAppToast();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationKey: SUBSCRIPTION_MUTATION_KEYS.purchase(),
    // 오프라인 동안 멈췄다가 연결되자마자 결제 창이 뜨지 않게 스토어 SDK에 바로 맡긴다(화면은 오프라인이면 버튼을 잠근다)
    networkMode: 'always',
    // 서버가 결제를 반영할 때까지 기다리는 동안에도 결제 중으로 두어 버튼을 잠근다
    mutationFn: async ({ identifier }: SubscriptionPlan) => {
      // 반영된 뒤에는 출처가 STORE라 보상 기간 중 결제였는지 결제 전에 읽어 둔다
      const previousAccess = getCachedMe(queryClient)?.premiumAccess;
      const hadRewardOnly =
        previousAccess != null && PremiumAccessPolicy.isGrantOnly(previousAccess);
      const hasStoreEntitlement = unwrap(await subscriptionService.purchase(identifier));
      const isReflected = hasStoreEntitlement && (await waitForStorePremium(queryClient));
      return { isReflected, hadRewardOnly };
    },
    // 성공은 결제 뒤 시작 화면이 알린다. 서버 반영이 늦을 때만 기다려 달라고 따로 알린다
    onSuccess: ({ isReflected }, plan) => {
      trackEvent('subscription_started', {
        product_id: plan.identifier,
        plan_type: plan.planType,
        is_trial: SubscriptionPolicy.hasFreeTrial(plan),
      });
      haptics.notify('success');
      if (!isReflected) {
        toast.toast(t('subscription:toast.purchaseSyncPending'));
      }
    },
    onError: (error, plan) =>
      match(getSubscriptionFailure(error))
        // 사용자가 직접 취소했으면 이미 알고 있어 알리지 않고 퍼널에만 남긴다
        .with('purchaseCancelled', () => {
          trackEvent('purchase_cancelled', {
            plan_type: plan.planType,
            is_trial: SubscriptionPolicy.hasFreeTrial(plan),
          });
        })
        .with('paymentPending', () => toast.success(t('subscription:toast.paymentPending')))
        // 돈이 빠져나갔을 수도 있어 문의할 길을 남기는 다이얼로그는 결제 버튼이 띄운다
        .with('network', 'server', 'store', 'purchaseFailed', 'restoreFailed', (cause) => {
          haptics.notify('error');
          const reason = toPurchaseFailedReason(cause);
          if (reason != null) {
            trackEvent('purchase_failed', {
              reason,
              plan_type: plan.planType,
              is_trial: SubscriptionPolicy.hasFreeTrial(plan),
            });
          }
          errorReporter.captureMessage(ERROR_REPORT_MESSAGES.SUBSCRIPTION_PURCHASE_FAILED, {
            feature: 'subscription',
            severity: 'warning',
            errorCode: getSubscriptionDiagnosticCode(error),
          });
        })
        .exhaustive(),
    meta: { errorFeedback: false },
  });
}

export function useRestoreMutationOptions() {
  const haptics = useHaptics();
  const subscriptionService = useSubscriptionService();
  const errorReporter = useErrorReporter();
  const { trackEvent } = useTrack();
  const toast = useAppToast();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationKey: SUBSCRIPTION_MUTATION_KEYS.restore(),
    // 오프라인 동안 멈췄다가 연결되자마자 결제 창이 뜨지 않게 스토어 SDK에 바로 맡긴다(화면은 오프라인이면 버튼을 잠근다)
    networkMode: 'always',
    // 복원한 구독은 서버가 스토어 웹훅(TRANSFER)을 반영할 때까지 기다려 복원 중으로 둔다(결제와 같은 대기)
    mutationFn: async () => {
      const hasRestoredStorePurchase = unwrap(await subscriptionService.restorePurchases());
      const isReflected = hasRestoredStorePurchase && (await waitForStorePremium(queryClient));
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
    // 문의로 잇는 토스트는 이동을 아는 복원 버튼이 이 onError에 이어 mutation 단계에서 띄운다
    onError: (error) =>
      match(getSubscriptionFailure(error))
        .with('purchaseCancelled', 'paymentPending', noop)
        .with('network', 'server', 'store', 'purchaseFailed', 'restoreFailed', (cause) => {
          haptics.notify('error');
          const reason = toPurchaseFailedReason(cause);
          if (reason != null) {
            trackEvent('subscription_restore_failed', { reason });
          }
          errorReporter.captureMessage(ERROR_REPORT_MESSAGES.SUBSCRIPTION_RESTORE_FAILED, {
            feature: 'subscription',
            severity: 'warning',
            errorCode: getSubscriptionDiagnosticCode(error),
          });
        })
        .exhaustive(),
    meta: { errorFeedback: false },
  });
}
