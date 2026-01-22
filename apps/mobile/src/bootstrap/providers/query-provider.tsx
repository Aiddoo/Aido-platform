import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';

const MIN_STALE_TIME = 1000 * 60 * 5; // 5 minutes
const MIN_GC_TIME = 1000 * 60 * 6; // 6 minutes

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: MIN_STALE_TIME,
      gcTime: MIN_GC_TIME,
      // TODO: 추후 프로젝트 특성에 알맞게 고치기
      retry: (failureCount, error) => {
        if (error instanceof Error && error.message.includes('401')) {
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
