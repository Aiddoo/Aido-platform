import { isApiError, isBusinessError } from '@src/shared/errors';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import type { AppStateStatus } from 'react-native';
import { AppState, Platform } from 'react-native';

/**
 * React Native에서는 브라우저의 `visibilitychange` 이벤트가 없으므로,
 * `AppState`를 React Query의 `focusManager`에 수동 연동한다.
 *
 * 앱이 백그라운드 → 포그라운드로 전환되면 stale 쿼리가 자동 refetch된다.
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/react-native#refetch-on-app-focus
 */
if (Platform.OS !== 'web') {
  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      handleFocus(status === 'active');
    });
    return () => subscription.remove();
  });
}

const MIN_STALE_TIME = 1000 * 60 * 5; // 5 minutes
const MIN_GC_TIME = 1000 * 60 * 6; // 6 minutes

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: MIN_STALE_TIME,
      gcTime: MIN_GC_TIME,
      retry: (failureCount, error) => {
        if (isApiError(error) && [401, 403].includes(error.status)) {
          return false;
        }

        if (isBusinessError(error)) {
          return false;
        }

        return failureCount < 3;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

/** 앱 전역 React Query 캐시 및 기본 옵션을 제공하는 Provider. */
export const QueryProvider = ({ children }: PropsWithChildren) => {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
