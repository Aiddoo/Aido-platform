import { USER_QUERY_KEYS } from '@src/features/user/presentations/constants/user-query-keys.constant';
import { getMeQueryOptions } from '@src/features/user/presentations/queries/get-me-query-options';
import { ENV } from '@src/shared/config/env';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type PropsWithChildren, useCallback, useEffect } from 'react';
import Purchases from 'react-native-purchases';

import { useAuth } from './auth-provider';
import { useRevenueCatSdkManager } from './di-provider';

export const RevenueCatProvider = ({ children }: PropsWithChildren) => {
  const { status } = useAuth();
  const sdkManager = useRevenueCatSdkManager();
  const queryClient = useQueryClient();
  const isAuthenticated = status === 'authenticated';

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
    ...getMeQueryOptions(),
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (isAuthenticated && user) {
      sdkManager.logIn(user.id);
    } else if (status === 'unauthenticated') {
      sdkManager.logOut();
    }
  }, [isAuthenticated, user, status, sdkManager]);

  // CustomerInfo 변경 리스너 — 외부 변경(설정 앱 취소, 환불 등) 감지
  const onCustomerInfoUpdated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.me() });
  }, [queryClient]);

  useEffect(() => {
    if (!isAuthenticated || !sdkManager.isConfigured()) {
      return undefined;
    }

    Purchases.addCustomerInfoUpdateListener(onCustomerInfoUpdated);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(onCustomerInfoUpdated);
    };
  }, [isAuthenticated, sdkManager, onCustomerInfoUpdated]);

  return <>{children}</>;
};
