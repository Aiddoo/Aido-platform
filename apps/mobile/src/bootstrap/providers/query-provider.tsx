import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import type { AppStateStatus } from 'react-native';
import { AppState, Platform } from 'react-native';

import { shouldRetryQuery } from './query-retry';

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
const MAX_RETRY_DELAY = 5000; // 재시도 백오프 상한 5초 — 죽은 서버를 과하게 두드리지 않는다

/**
 * 상한 지수 백오프: 1s → 2s → 4s → 5s → 5s → 5s.
 * `shouldRetryQuery`의 일시 인프라 장애 6회와 합치면 재시도 창 ≈ 22초로,
 * 서버 재시작(≈5-10초)을 덮어 재시도 화면 대신 로딩을 유지한다.
 */
const retryDelay = (attempt: number): number => Math.min(1000 * 2 ** attempt, MAX_RETRY_DELAY);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: MIN_STALE_TIME,
      gcTime: MIN_GC_TIME,
      retry: shouldRetryQuery,
      retryDelay,
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
