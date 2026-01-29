import { isApiError, isClientError } from '@src/shared/errors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';

const MIN_STALE_TIME = 1000 * 60 * 5; // 5 minutes
const MIN_GC_TIME = 1000 * 60 * 6; // 6 minutes

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: MIN_STALE_TIME,
      gcTime: MIN_GC_TIME,
      retry: (failureCount, error) => {
        // 인증 에러: 재시도 무의미 (토큰 갱신 훅에서 처리)
        if (isApiError(error) && [401, 403].includes(error.status)) {
          return false;
        }

        // 클라이언트 에러 (취소, 검증 실패): 재시도 무의미
        if (isClientError(error)) {
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

export const QueryProvider = ({ children }: PropsWithChildren) => {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
