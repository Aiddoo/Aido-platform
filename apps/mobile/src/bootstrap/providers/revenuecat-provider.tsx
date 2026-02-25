import { getMeQueryOptions } from '@src/features/user/presentations/queries/get-me-query-options';
import { ENV } from '@src/shared/config/env';
import { useQuery } from '@tanstack/react-query';
import { type PropsWithChildren, useEffect } from 'react';

import { useAuth } from './auth-provider';
import { useRevenueCatSdkManager } from './di-provider';

export const RevenueCatProvider = ({ children }: PropsWithChildren) => {
  const { status } = useAuth();
  const sdkManager = useRevenueCatSdkManager();
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

  return <>{children}</>;
};
