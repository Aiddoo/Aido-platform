import { invalidatePremiumAiQueries } from '@src/features/ai/queries/ai-cache';
import { invalidateMemoResourceLimit } from '@src/features/memo/queries/memo-cache';
import { invalidateNudgeLimit } from '@src/features/nudge/queries/nudge-cache';
import { CustomerInfoPolicy } from '@src/features/subscription/apis/customer-info.policy';
import { WEBHOOK_SYNC_DELAY } from '@src/features/subscription/constants/webhook-sync';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { invalidateMe } from '@src/features/user/queries/user-cache';
import { ENV } from '@src/shared/config/env';
import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { debounce } from 'es-toolkit';
import { type PropsWithChildren, useCallback, useEffect, useMemo } from 'react';
import Purchases, { type CustomerInfo } from 'react-native-purchases';

import { useAuth } from './auth-provider';
import { useRevenueCatSdkManager } from './di-context';

const invalidateSubscriptionQueries = (queryClient: QueryClient) => {
  invalidateMe(queryClient);
  invalidateNudgeLimit(queryClient);
  invalidatePremiumAiQueries(queryClient);
  invalidateMemoResourceLimit(queryClient);
};

export function RevenueCatProvider({ children }: PropsWithChildren) {
  const { status } = useAuth();
  const sdkManager = useRevenueCatSdkManager();
  const queryClient = useQueryClient();
  const isAuthenticated = status === 'authenticated';

  const syncServerAfterWebhook = useMemo(
    () =>
      debounce(() => {
        invalidateSubscriptionQueries(queryClient);
      }, WEBHOOK_SYNC_DELAY),
    [queryClient],
  );

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
  // 프리미엄은 스토어 구독과 보상 기간을 합친 서버 값이 단일 원천이라 캐시에 쓰지 않고 다시 불러온다.
  const onCustomerInfoUpdated = useCallback(
    (info: CustomerInfo) => {
      if (CustomerInfoPolicy.hasStoreEntitlement(info.entitlements)) {
        // 구독 활성화: 웹훅 처리 대기 후 서버 동기화
        syncServerAfterWebhook();
        return;
      }

      // 구독 비활성화 (취소/환불/만료): 즉시 서버 동기화
      syncServerAfterWebhook.cancel();
      invalidateSubscriptionQueries(queryClient);
    },
    [queryClient, syncServerAfterWebhook],
  );

  useEffect(() => {
    if (!isAuthenticated || !sdkManager.isConfigured()) {
      return undefined;
    }

    Purchases.addCustomerInfoUpdateListener(onCustomerInfoUpdated);

    return () => {
      Purchases.removeCustomerInfoUpdateListener(onCustomerInfoUpdated);
      syncServerAfterWebhook.cancel();
    };
  }, [isAuthenticated, sdkManager, onCustomerInfoUpdated, syncServerAfterWebhook]);

  return <>{children}</>;
}
