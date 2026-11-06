import { WEBHOOK_SYNC_DELAY } from '@src/features/billing/subscription/constants/webhook-sync';
import {
  type CustomerInfo,
  CustomerInfoPolicy,
} from '@src/features/billing/subscription/domains/customer-info.model';
import { useRefreshOnPremiumEnd } from '@src/features/billing/subscription/hooks/use-refresh-on-premium-end';
import { invalidateEntitlements } from '@src/features/billing/subscription/queries/entitlement-cache';
import { watchPremiumEntitlementChanges } from '@src/features/billing/subscription/queries/subscription-cache';
import type { PremiumAccess } from '@src/features/identity/user/domains/premium-access.model';
import { invalidateMe } from '@src/features/identity/user/queries/user-cache';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { ENV } from '@src/shared/config/env';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { debounce } from 'es-toolkit';
import { type PropsWithChildren, useCallback, useEffect, useMemo } from 'react';

import { useAuth } from './auth-provider';
import { usePurchasesSdkManager, useSubscriptionService } from './di-context';

export function RevenueCatProvider({ children }: PropsWithChildren) {
  const { status } = useAuth();
  const sdkManager = usePurchasesSdkManager();
  const subscriptionService = useSubscriptionService();
  const queryClient = useQueryClient();
  const isAuthenticated = status === 'authenticated';

  const syncServerAfterWebhook = useMemo(
    () =>
      debounce(() => {
        invalidateMe(queryClient);
        invalidateEntitlements(queryClient);
      }, WEBHOOK_SYNC_DELAY),
    [queryClient],
  );

  // 프리미엄 의존 쿼리는 내 정보가 실제로 바뀌었을 때만 따라 갱신한다(스토어 이벤트가 없는 보상 기간 포함)
  useEffect(() => watchPremiumEntitlementChanges(queryClient), [queryClient]);

  // SDK 초기화 (앱 시작 시 1회)
  useEffect(() => {
    if (ENV.REVENUECAT_API_KEY) {
      sdkManager.configure(ENV.REVENUECAT_API_KEY);
    }
  }, [sdkManager]);

  // 사용자 동기화
  // When authenticated, we need the user ID to sync with RevenueCat
  // Use useQuery (not useSuspenseQuery) because this provider is above the auth gate
  // and we don't want to suspend while loading user data
  const { data: user } = useQuery({
    ...useGetMeQueryOptions(),
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (isAuthenticated && user) {
      sdkManager.logIn(user.id);
    }

    if (status === 'unauthenticated') {
      sdkManager.logOut();
    }
  }, [isAuthenticated, user, status, sdkManager]);

  // CustomerInfo 변경 리스너 — 이 기기 구매/복원, 다른 기기 변경, 스토어 직접 취소를 모두 받는다.
  // 프리미엄은 스토어 구독과 보상 기간을 합친 서버 값이 단일 원천이라 캐시에 쓰지 않고 내 정보·권한만 다시 불러온다.
  const onCustomerInfoUpdated = useCallback(
    (customerInfo: CustomerInfo) => {
      if (CustomerInfoPolicy.hasStoreEntitlement(customerInfo)) {
        // 구독 활성화: 웹훅 처리 대기 후 서버 동기화
        syncServerAfterWebhook();
        return;
      }

      // 구독 비활성화 (취소/환불/만료): 즉시 서버 동기화
      syncServerAfterWebhook.cancel();
      invalidateMe(queryClient);
      invalidateEntitlements(queryClient);
    },
    [queryClient, syncServerAfterWebhook],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    const unsubscribe = subscriptionService.subscribeCustomerInfo(onCustomerInfoUpdated);

    return () => {
      unsubscribe();
      syncServerAfterWebhook.cancel();
    };
  }, [isAuthenticated, subscriptionService, onCustomerInfoUpdated, syncServerAfterWebhook]);

  return (
    <>
      {user?.premiumAccess.endsAt != null && <PremiumEndSync access={user.premiumAccess} />}
      {children}
    </>
  );
}

/** 끝나는 시각이 있는 프리미엄일 때만 분 시계를 구독해, 무료 사용자에게는 타이머를 두지 않는다 */
function PremiumEndSync({ access }: { access: PremiumAccess }) {
  useRefreshOnPremiumEnd(access);
  return null;
}
