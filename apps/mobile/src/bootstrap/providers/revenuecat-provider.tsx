import { WEBHOOK_SYNC_DELAY } from '@src/features/subscription/presentations/constants/subscription-query-keys.constant';
import { TODO_QUERY_KEYS } from '@src/features/todo/presentations/constants/todo-query-keys.constant';
import type { User } from '@src/features/user/models/user.model';
import { USER_QUERY_KEYS } from '@src/features/user/presentations/constants/user-query-keys.constant';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/use-get-me-query-options';
import { ENV } from '@src/shared/config/env';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type PropsWithChildren, useCallback, useEffect, useRef } from 'react';
import Purchases, { type CustomerInfo } from 'react-native-purchases';

import { useAuth } from './auth-provider';
import { useRevenueCatSdkManager } from './di-provider';

export const RevenueCatProvider = ({ children }: PropsWithChildren) => {
  const { status } = useAuth();
  const sdkManager = useRevenueCatSdkManager();
  const queryClient = useQueryClient();
  const isAuthenticated = status === 'authenticated';
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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

  // CustomerInfo 변경 리스너 — 데이터 동기화의 단일 진입점
  // 이 기기 구매/복원, 다른 기기 변경, 스토어 직접 취소 등 모든 변경을 여기서 처리
  const onCustomerInfoUpdated = useCallback(
    (info: CustomerInfo) => {
      const hasActive = Object.keys(info.entitlements.active).length > 0;

      // SDK 상태로 캐시 즉시 반영 (낙관적 업데이트)
      queryClient.setQueryData<User>(USER_QUERY_KEYS.me(), (old) => {
        if (!old) return old;
        const nextStatus = hasActive ? ('ACTIVE' as const) : ('FREE' as const);
        if (old.subscriptionStatus === nextStatus) return old;
        return { ...old, subscriptionStatus: nextStatus };
      });

      // 이전 타이머 취소 (연속 이벤트 debounce)
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }

      const invalidateAll = () => {
        queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.me() });
        queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.nudgeLimit() });
      };

      if (hasActive) {
        // 구독 활성화: 웹훅 처리 대기 후 서버 동기화
        syncTimerRef.current = setTimeout(invalidateAll, WEBHOOK_SYNC_DELAY);
      } else {
        // 구독 비활성화 (취소/환불/만료): 즉시 서버 동기화
        invalidateAll();
      }
    },
    [queryClient],
  );

  useEffect(() => {
    if (!isAuthenticated || !sdkManager.isConfigured()) {
      return undefined;
    }

    Purchases.addCustomerInfoUpdateListener(onCustomerInfoUpdated);

    return () => {
      Purchases.removeCustomerInfoUpdateListener(onCustomerInfoUpdated);
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
    };
  }, [isAuthenticated, sdkManager, onCustomerInfoUpdated]);

  return <>{children}</>;
};
