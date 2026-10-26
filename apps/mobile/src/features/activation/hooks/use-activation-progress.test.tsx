import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { useActivationProgress } from './use-activation-progress';

jest.mock('@src/bootstrap/providers/auth-provider', () => ({
  useAuth: () => ({ status: 'authenticated' }),
}));

jest.mock('@src/features/feature-discovery/queries/get-feature-discovery-query-options', () => ({
  useGetFeatureDiscoveryQueryOptions: () => ({
    queryKey: ['feature-discovery'],
    queryFn: () => Promise.reject(new Error('campaign config unavailable')),
    retry: false,
  }),
}));

jest.mock('@src/features/user/queries/get-me-query-options', () => ({
  useGetMeQueryOptions: () => ({
    queryKey: ['me'],
    queryFn: async () => ({
      id: 'existing-user',
      createdAt: new Date('2026-07-31T23:59:59.999Z'),
    }),
    retry: false,
  }),
}));

jest.mock('@src/bootstrap/providers/di-context', () => ({
  useActivationService: () => ({
    getProgress: jest.fn(),
  }),
}));

describe('활성화 진행 상태의 기존 사용자 호환성', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  });

  afterEach(() => {
    client.clear();
  });

  it('캠페인 설정 요청이 실패해도 사용자 조회가 끝나면 기존 동작을 계속할 수 있다', async () => {
    // When
    const { result } = await renderHook(() => useActivationProgress(), {
      wrapper: ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    // Then
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.config).toBeUndefined();
    expect(result.current.user?.id).toBe('existing-user');
  });
});
